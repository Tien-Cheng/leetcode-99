"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type {
  ServerMessage,
  ClientMessage,
  RoomSnapshotPayload,
  SettingsUpdatePayload,
  MatchStartedPayload,
  MatchPhaseUpdatePayload,
  PlayerUpdatePayload,
  JudgeResultPayload,
  StackUpdatePayload,
  ChatAppendPayload,
  AttackReceivedPayload,
  EventLogAppendPayload,
  SpectateStatePayload,
  CodeUpdateServerPayload,
  MatchEndPayload,
  ErrorPayload,
} from "@leet99/contracts";
import type {
  TargetingMode,
  ShopItem,
  RoomSettings,
} from "@leet99/contracts";

interface UseWebSocketOptions {
  wsUrl: string;
  playerId: string;
  playerToken: string;
  onRoomSnapshot?: (payload: RoomSnapshotPayload) => void;
  onSettingsUpdate?: (payload: SettingsUpdatePayload) => void;
  onMatchStarted?: (payload: MatchStartedPayload) => void;
  onMatchPhaseUpdate?: (payload: MatchPhaseUpdatePayload) => void;
  onPlayerUpdate?: (payload: PlayerUpdatePayload) => void;
  onJudgeResult?: (payload: JudgeResultPayload) => void;
  onStackUpdate?: (payload: StackUpdatePayload) => void;
  onChatAppend?: (payload: ChatAppendPayload) => void;
  onAttackReceived?: (payload: AttackReceivedPayload) => void;
  onEventLogAppend?: (payload: EventLogAppendPayload) => void;
  onSpectateState?: (payload: SpectateStatePayload) => void;
  onCodeUpdate?: (payload: CodeUpdateServerPayload) => void;
  onMatchEnd?: (payload: MatchEndPayload) => void;
  onError?: (payload: ErrorPayload) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  sendChat: (message: string) => void;
  runCode: (problemId: string, code: string) => Promise<void>;
  submitCode: (problemId: string, code: string) => Promise<void>;
  updateSettings: (patch: Partial<RoomSettings>) => void;
  spendPoints: (item: ShopItem) => void;
  setTargetMode: (mode: TargetingMode) => void;
  spectatePlayer: (playerId: string) => void;
  stopSpectate: () => void;
  updateCode: (problemId: string, code: string, codeVersion: number) => void;
  startMatch: () => void;
  addBots: (count: number) => void;
  returnToLobby: () => void;
}

/**
 * WebSocket connection hook for PartyKit room
 * Handles all real-time communication with the game server
 */
export function useWebSocket(
  options: UseWebSocketOptions
): UseWebSocketReturn {
  const {
    wsUrl,
    playerId,
    playerToken,
    onRoomSnapshot,
    onSettingsUpdate,
    onMatchStarted,
    onMatchPhaseUpdate,
    onPlayerUpdate,
    onJudgeResult,
    onStackUpdate,
    onChatAppend,
    onAttackReceived,
    onEventLogAppend,
    onSpectateState,
    onCodeUpdate,
    onMatchEnd,
    onError,
    onConnect,
    onDisconnect,
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const requestIdCounterRef = useRef(0);
  const pendingRequestsRef = useRef<
    Map<string, { resolve: () => void; reject: (error: Error) => void }>
  >(new Map());

  // Store callbacks in refs to avoid dependency issues
  const handlersRef = useRef({
    onRoomSnapshot,
    onSettingsUpdate,
    onMatchStarted,
    onMatchPhaseUpdate,
    onPlayerUpdate,
    onJudgeResult,
    onStackUpdate,
    onChatAppend,
    onAttackReceived,
    onEventLogAppend,
    onSpectateState,
    onCodeUpdate,
    onMatchEnd,
    onError,
    onConnect,
    onDisconnect,
  });

  // Update handlers ref when they change
  handlersRef.current = {
    onRoomSnapshot,
    onSettingsUpdate,
    onMatchStarted,
    onMatchPhaseUpdate,
    onPlayerUpdate,
    onJudgeResult,
    onStackUpdate,
    onChatAppend,
    onAttackReceived,
    onEventLogAppend,
    onSpectateState,
    onCodeUpdate,
    onMatchEnd,
    onError,
    onConnect,
    onDisconnect,
  };

  // Generate unique request ID
  const generateRequestId = useCallback(() => {
    requestIdCounterRef.current += 1;
    return `req_${playerId}_${requestIdCounterRef.current}_${Date.now()}`;
  }, [playerId]);

  // Send message helper
  const sendMessage = useCallback(
    <T extends ClientMessage>(message: T) => {
      const attemptSend = () => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify(message));
          return true;
        }
        return false;
      };

      // Try to send immediately
      if (attemptSend()) {
        return;
      }

      // If WebSocket is connecting, wait a bit and try again
      if (wsRef.current?.readyState === WebSocket.CONNECTING) {
        setTimeout(() => {
          if (!attemptSend()) {
            console.warn("WebSocket not connected after wait, cannot send message:", message.type);
          }
        }, 100);
      } else {
        // WebSocket is closed or not initialized
        console.warn("WebSocket not connected, cannot send message:", message.type);
      }
    },
    []
  );

  // Send message with promise (for request/response pattern)
  const sendMessageWithResponse = useCallback(
    <T extends ClientMessage>(message: T): Promise<void> => {
      return new Promise((resolve, reject) => {
        // Wait for connection if not ready
        const attemptSend = () => {
          if (wsRef.current?.readyState !== WebSocket.OPEN) {
            reject(new Error("WebSocket not connected"));
            return;
          }

          const requestId = generateRequestId();
          const messageWithId = { ...message, requestId };

          // Store pending request
          pendingRequestsRef.current.set(requestId, { resolve, reject });

          // Send message
          wsRef.current.send(JSON.stringify(messageWithId));

          // Auto-resolve after timeout (server doesn't always send response)
          setTimeout(() => {
            if (pendingRequestsRef.current.has(requestId)) {
              pendingRequestsRef.current.delete(requestId);
              resolve();
            }
          }, 10000);
        };

        // If WebSocket is connecting, wait a bit
        if (wsRef.current?.readyState === WebSocket.CONNECTING) {
          setTimeout(attemptSend, 100);
        } else {
          attemptSend();
        }
      });
    },
    [generateRequestId]
  );

  // Handle incoming messages
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data) as ServerMessage;

        // If this is a response to a pending request, resolve it
        if (message.requestId && pendingRequestsRef.current.has(message.requestId)) {
          const { resolve } = pendingRequestsRef.current.get(message.requestId)!;
          pendingRequestsRef.current.delete(message.requestId);

          // If it's an error response, we don't resolve yet - let the error handler reject
          if (message.type !== "ERROR") {
            resolve();
          }
        }

        // Route to appropriate handler using refs
        const handlers = handlersRef.current;
        switch (message.type) {
          case "ROOM_SNAPSHOT":
            handlers.onRoomSnapshot?.(message.payload);
            break;
          case "SETTINGS_UPDATE":
            handlers.onSettingsUpdate?.(message.payload);
            break;
          case "MATCH_STARTED":
            handlers.onMatchStarted?.(message.payload);
            break;
          case "MATCH_PHASE_UPDATE":
            handlers.onMatchPhaseUpdate?.(message.payload);
            break;
          case "PLAYER_UPDATE":
            handlers.onPlayerUpdate?.(message.payload);
            break;
          case "JUDGE_RESULT":
            handlers.onJudgeResult?.(message.payload);
            break;
          case "STACK_UPDATE":
            handlers.onStackUpdate?.(message.payload);
            break;
          case "CHAT_APPEND":
            handlers.onChatAppend?.(message.payload);
            break;
          case "ATTACK_RECEIVED":
            handlers.onAttackReceived?.(message.payload);
            break;
          case "EVENT_LOG_APPEND":
            handlers.onEventLogAppend?.(message.payload);
            break;
          case "SPECTATE_STATE":
            handlers.onSpectateState?.(message.payload);
            break;
          case "CODE_UPDATE":
            handlers.onCodeUpdate?.(message.payload);
            break;
          case "MATCH_END":
            handlers.onMatchEnd?.(message.payload);
            break;
          case "ERROR":
            handlers.onError?.(message.payload);
            // If this was in response to a request, reject the promise
            if (message.requestId && pendingRequestsRef.current.has(message.requestId)) {
              const { reject } = pendingRequestsRef.current.get(message.requestId)!;
              pendingRequestsRef.current.delete(message.requestId);
              reject(new Error(message.payload.message));
            }
            break;
        }
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error);
      }
    },
    [] // No dependencies - use ref instead
  );

  // Connect to WebSocket
  const connect = useCallback(() => {
    // Clean up existing connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("WebSocket connected");
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
        handlersRef.current.onConnect?.();

        // Send JOIN_ROOM message directly (ws is guaranteed to be OPEN here)
        ws.send(JSON.stringify({
          type: "JOIN_ROOM",
          payload: { playerToken },
        }));
      };

      ws.onmessage = handleMessage;

      ws.onerror = (error) => {
        const state = ws.readyState;
        const stateName = state === WebSocket.CONNECTING ? "CONNECTING" :
                         state === WebSocket.OPEN ? "OPEN" :
                         state === WebSocket.CLOSING ? "CLOSING" :
                         state === WebSocket.CLOSED ? "CLOSED" : "UNKNOWN";
        
        // Extract host from URL for better error messages
        let hostInfo = "";
        try {
          const url = new URL(wsUrl);
          hostInfo = `${url.hostname}:${url.port || (url.protocol === "wss:" ? 443 : 80)}`;
        } catch {
          hostInfo = wsUrl;
        }
        
        console.error("WebSocket error:", {
          type: error.type,
          readyState: stateName,
          url: wsUrl,
          host: hostInfo,
          timestamp: new Date().toISOString(),
          hint: stateName === "CLOSED" ? "Connection failed. Ensure the PartyKit server is running." : undefined,
        });
      };

      ws.onclose = (event) => {
        const closeInfo = {
          code: event.code,
          reason: event.reason || "No reason provided",
          wasClean: event.wasClean,
        };
        
        // Provide helpful error messages for common close codes
        let errorMessage = "";
        if (event.code === 1006) {
          errorMessage = "Connection failed. Is the PartyKit server running?";
        } else if (event.code === 1000) {
          errorMessage = "Connection closed normally";
        } else if (event.code === 1001) {
          errorMessage = "Server is going away";
        } else if (event.code === 1002) {
          errorMessage = "Protocol error";
        } else if (event.code === 1003) {
          errorMessage = "Unsupported data type";
        } else if (event.code === 1008) {
          errorMessage = "Policy violation";
        } else if (event.code === 1011) {
          errorMessage = "Server error";
        }
        
        if (errorMessage && !event.wasClean) {
          console.error("WebSocket disconnected:", errorMessage, closeInfo);
        } else {
          console.log("WebSocket disconnected", closeInfo);
        }
        
        setIsConnected(false);
        wsRef.current = null;
        handlersRef.current.onDisconnect?.();

        // Don't reconnect if we're cleaning up
        if (isCleaningUpRef.current) {
          console.log("Not reconnecting (component unmounting)");
          return;
        }

        // Attempt to reconnect with exponential backoff
        const delay = Math.min(
          1000 * Math.pow(2, reconnectAttemptsRef.current),
          30000
        );
        reconnectAttemptsRef.current += 1;

        console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      };
    } catch (error) {
      console.error("Failed to connect WebSocket:", error);
    }
  }, [wsUrl, playerToken, handleMessage]); // Use handlersRef for callbacks

  // Track if we're intentionally disconnecting (for cleanup)
  const isCleaningUpRef = useRef(false);

  // Initialize connection on mount
  useEffect(() => {
    isCleaningUpRef.current = false;
    connect();

    // Cleanup on unmount
    return () => {
      isCleaningUpRef.current = true;

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      // Reject all pending requests
      pendingRequestsRef.current.forEach(({ reject }) => {
        reject(new Error("WebSocket connection closed"));
      });
      pendingRequestsRef.current.clear();
      setIsConnected(false);
    };
  }, [connect]);

  // Public API methods
  const sendChat = useCallback(
    (text: string) => {
      sendMessage({
        type: "SEND_CHAT",
        payload: { text },
      });
    },
    [sendMessage]
  );

  const runCode = useCallback(
    async (problemId: string, code: string) => {
      await sendMessageWithResponse({
        type: "RUN_CODE",
        payload: { problemId, code },
      });
    },
    [sendMessageWithResponse]
  );

  const submitCode = useCallback(
    async (problemId: string, code: string) => {
      await sendMessageWithResponse({
        type: "SUBMIT_CODE",
        payload: { problemId, code },
      });
    },
    [sendMessageWithResponse]
  );

  const updateSettings = useCallback(
    (patch: Partial<RoomSettings>) => {
      sendMessage({
        type: "UPDATE_SETTINGS",
        payload: { patch },
      });
    },
    [sendMessage]
  );

  const spendPoints = useCallback(
    (item: ShopItem) => {
      sendMessage({
        type: "SPEND_POINTS",
        payload: { item },
      });
    },
    [sendMessage]
  );

  const setTargetMode = useCallback(
    (mode: TargetingMode) => {
      sendMessage({
        type: "SET_TARGET_MODE",
        payload: { mode },
      });
    },
    [sendMessage]
  );

  const spectatePlayer = useCallback(
    (playerId: string) => {
      sendMessage({
        type: "SPECTATE_PLAYER",
        payload: { playerId },
      });
    },
    [sendMessage]
  );

  const stopSpectate = useCallback(() => {
    sendMessage({
      type: "STOP_SPECTATE",
      payload: {},
    });
  }, [sendMessage]);

  const updateCode = useCallback(
    (problemId: string, code: string, codeVersion: number) => {
      sendMessage({
        type: "CODE_UPDATE",
        payload: { problemId, code, codeVersion },
      });
    },
    [sendMessage]
  );

  const startMatch = useCallback(() => {
    sendMessage({
      type: "START_MATCH",
      payload: {},
    });
  }, [sendMessage]);

  const addBots = useCallback(
    (count: number) => {
      sendMessage({
        type: "ADD_BOTS",
        payload: { count },
      });
    },
    [sendMessage]
  );

  const returnToLobby = useCallback(() => {
    sendMessage({
      type: "RETURN_TO_LOBBY",
      payload: {},
    });
  }, [sendMessage]);

  return {
    isConnected,
    sendChat,
    runCode,
    submitCode,
    updateSettings,
    spendPoints,
    setTargetMode,
    spectatePlayer,
    stopSpectate,
    updateCode,
    startMatch,
    addBots,
    returnToLobby,
  };
}
