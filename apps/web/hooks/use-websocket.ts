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

  // Generate unique request ID
  const generateRequestId = useCallback(() => {
    requestIdCounterRef.current += 1;
    return `req_${playerId}_${requestIdCounterRef.current}_${Date.now()}`;
  }, [playerId]);

  // Send message helper
  const sendMessage = useCallback(
    <T extends ClientMessage>(message: T) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(message));
      } else {
        console.warn("WebSocket not connected, cannot send message:", message);
      }
    },
    []
  );

  // Send message with promise (for request/response pattern)
  const sendMessageWithResponse = useCallback(
    <T extends ClientMessage>(message: T): Promise<void> => {
      return new Promise((resolve, reject) => {
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

        // Timeout after 30 seconds
        setTimeout(() => {
          if (pendingRequestsRef.current.has(requestId)) {
            pendingRequestsRef.current.delete(requestId);
            reject(new Error("Request timeout"));
          }
        }, 30000);
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

        // Route to appropriate handler
        switch (message.type) {
          case "ROOM_SNAPSHOT":
            onRoomSnapshot?.(message.payload);
            break;
          case "SETTINGS_UPDATE":
            onSettingsUpdate?.(message.payload);
            break;
          case "MATCH_STARTED":
            onMatchStarted?.(message.payload);
            break;
          case "MATCH_PHASE_UPDATE":
            onMatchPhaseUpdate?.(message.payload);
            break;
          case "PLAYER_UPDATE":
            onPlayerUpdate?.(message.payload);
            break;
          case "JUDGE_RESULT":
            onJudgeResult?.(message.payload);
            break;
          case "STACK_UPDATE":
            onStackUpdate?.(message.payload);
            break;
          case "CHAT_APPEND":
            onChatAppend?.(message.payload);
            break;
          case "ATTACK_RECEIVED":
            onAttackReceived?.(message.payload);
            break;
          case "EVENT_LOG_APPEND":
            onEventLogAppend?.(message.payload);
            break;
          case "SPECTATE_STATE":
            onSpectateState?.(message.payload);
            break;
          case "CODE_UPDATE":
            onCodeUpdate?.(message.payload);
            break;
          case "MATCH_END":
            onMatchEnd?.(message.payload);
            break;
          case "ERROR":
            onError?.(message.payload);
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
    [
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
    ]
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
        onConnect?.();

        // Send JOIN_ROOM message
        sendMessage({
          type: "JOIN_ROOM",
          payload: { playerToken },
        });
      };

      ws.onmessage = handleMessage;

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      ws.onclose = () => {
        console.log("WebSocket disconnected");
        setIsConnected(false);
        wsRef.current = null;
        onDisconnect?.();

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
  }, [wsUrl, playerToken, handleMessage, onConnect, onDisconnect, sendMessage]);

  // Initialize connection on mount
  useEffect(() => {
    connect();

    // Cleanup on unmount
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
      // Reject all pending requests
      pendingRequestsRef.current.forEach(({ reject }) => {
        reject(new Error("WebSocket connection closed"));
      });
      pendingRequestsRef.current.clear();
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
