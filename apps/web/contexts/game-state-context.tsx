"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { useWebSocket } from "../hooks/use-websocket";
import type {
  RoomSnapshotPayload,
  MatchStartedPayload,
  PlayerPublic,
  RoomSettings,
  MatchPhase,
  PlayerPrivateState,
  ProblemClientView,
  ProblemSummary,
  ActiveDebuff,
  ShopCatalogItem,
  EventLogEntry,
  JudgeResult,
  SpectateView,
  ChatMessage,
  TargetingMode,
  ShopItem,
} from "@leet99/contracts";

interface GameStateContextValue {
  // Connection state
  isConnected: boolean;

  // Room state
  roomId: string | null;
  serverTime: string | null;
  playersPublic: PlayerPublic[];
  roomSettings: RoomSettings | null;
  matchPhase: MatchPhase;
  matchEndAt: string | null;

  // Player state
  playerId: string | null;
  username: string | null;
  isHost: boolean;
  playerPrivateState: PlayerPrivateState | null;
  currentProblem: ProblemClientView | null;
  problemStack: ProblemSummary[];
  activeDebuff: ActiveDebuff | null;
  score: number;
  solveStreak: number;
  targetingMode: TargetingMode;

  // Spectator state
  spectateState: SpectateView | null;

  // Chat and logs
  chat: ChatMessage[];
  eventLog: EventLogEntry[];
  lastJudgeResult: JudgeResult | null;

  // Shop
  shopCatalog: ShopCatalogItem[];

  // Actions
  sendChat: (message: string) => void;
  runCode: (code: string) => Promise<void>;
  submitCode: (code: string) => Promise<void>;
  purchaseItem: (item: ShopItem) => void;
  setTargetMode: (mode: TargetingMode) => void;
  spectatePlayer: (playerId: string) => void;
  stopSpectate: () => void;
  updateCode: (code: string, version: number) => void;
  updateSettings: (patch: Partial<RoomSettings>) => void;
  startMatch: () => void;
  addBots: (count: number) => void;
  returnToLobby: () => void;
}

const GameStateContext = createContext<GameStateContextValue | undefined>(
  undefined
);

interface GameStateProviderProps {
  children: ReactNode;
  wsUrl: string;
  playerId: string;
  playerToken: string;
}

export function GameStateProvider({
  children,
  wsUrl,
  playerId,
  playerToken,
}: GameStateProviderProps) {
  // Room state
  const [roomId, setRoomId] = useState<string | null>(null);
  const [serverTime, setServerTime] = useState<string | null>(null);
  const [playersPublic, setPlayersPublic] = useState<PlayerPublic[]>([]);
  const [roomSettings, setRoomSettings] = useState<RoomSettings | null>(null);
  const [matchPhase, setMatchPhase] = useState<MatchPhase>("lobby");
  const [matchEndAt, setMatchEndAt] = useState<string | null>(null);

  // Player state
  const [username, setUsername] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [playerPrivateState, setPlayerPrivateState] =
    useState<PlayerPrivateState | null>(null);
  const [activeDebuff, setActiveDebuff] = useState<ActiveDebuff | null>(null);
  const [score, setScore] = useState(0);
  const [solveStreak, setSolveStreak] = useState(0);
  const [targetingMode, setTargetingModeState] =
    useState<TargetingMode>("random");

  // Spectator state
  const [spectateState, setSpectateState] = useState<SpectateView | null>(null);

  // Chat and logs
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [eventLog, setEventLog] = useState<EventLogEntry[]>([]);
  const [lastJudgeResult, setLastJudgeResult] = useState<JudgeResult | null>(
    null
  );

  // Shop
  const [shopCatalog, setShopCatalog] = useState<ShopCatalogItem[]>([]);

  // Derived state
  const currentProblem = playerPrivateState?.currentProblem ?? null;
  const problemStack = playerPrivateState?.queued ?? [];

  // Clear judge result when problem changes
  useEffect(() => {
    setLastJudgeResult(null);
  }, [currentProblem?.problemId]);

  // WebSocket handlers
  const handleRoomSnapshot = useCallback((payload: RoomSnapshotPayload) => {
    setRoomId(payload.roomId);
    setServerTime(payload.serverTime);
    setPlayersPublic(payload.players);
    setRoomSettings(payload.match.settings);
    setMatchPhase(payload.match.phase);
    setMatchEndAt(payload.match.endAt ?? null);
    setUsername(payload.me.username);
    setIsHost(payload.me.isHost);
    setChat(payload.chat);
    setEventLog(payload.eventLog);

    if (payload.self) {
      setPlayerPrivateState(payload.self);
    }

    // Get player's public data to extract score/streak/etc
    const myPublicData = payload.players.find(p => p.playerId === payload.me.playerId);
    if (myPublicData) {
      setActiveDebuff(myPublicData.activeDebuff ?? null);
      setScore(myPublicData.score);
      setSolveStreak(myPublicData.streak);
      setTargetingModeState(myPublicData.targetingMode);
    }

    if (payload.spectating !== undefined) {
      setSpectateState(payload.spectating);
    }

    if (payload.shopCatalog) {
      setShopCatalog(payload.shopCatalog);
    }
  }, []);

  const handleSettingsUpdate = useCallback(
    (payload: { settings: RoomSettings }) => {
      setRoomSettings(payload.settings);
    },
    []
  );

  const handleMatchStarted = useCallback(
    (payload: MatchStartedPayload) => {
      setMatchPhase(payload.match.phase);
      setMatchEndAt(payload.match.endAt ?? null);
    },
    []
  );

  const handleMatchPhaseUpdate = useCallback(
    (payload: { matchId: string; phase: MatchPhase }) => {
      setMatchPhase(payload.phase);
    },
    []
  );

  const handlePlayerUpdate = useCallback((payload: { player: PlayerPublic }) => {
    setPlayersPublic((prev) =>
      prev.map((p) =>
        p.playerId === payload.player.playerId ? payload.player : p
      )
    );

    // Update our local state if this is us
    if (payload.player.playerId === playerId) {
      setActiveDebuff(payload.player.activeDebuff ?? null);
      setScore(payload.player.score);
      setSolveStreak(payload.player.streak);
      setTargetingModeState(payload.player.targetingMode);
    }
  }, [playerId]);

  const handleJudgeResult = useCallback((payload: JudgeResult) => {
    setLastJudgeResult(payload);
    // Score updates will come through PLAYER_UPDATE messages
  }, []);

  const handleStackUpdate = useCallback(
    (payload: { playerId: string; stackSize: number }) => {
      if (payload.playerId === playerId) {
        // Stack size changed - we'll get the full state in ROOM_SNAPSHOT or PLAYER_UPDATE
      }
    },
    [playerId]
  );

  const handleChatAppend = useCallback((payload: { message: ChatMessage }) => {
    setChat((prev) => [...prev, payload.message]);
  }, []);

  const handleAttackReceived = useCallback(
    (payload: {
      type: string;
      fromPlayerId: string;
      endsAt?: string;
      addedProblem?: ProblemSummary;
    }) => {
      // Update active debuff if this is a debuff attack
      if (
        payload.type === "ddos" ||
        payload.type === "flashbang" ||
        payload.type === "vimLock" ||
        payload.type === "memoryLeak"
      ) {
        if (payload.endsAt) {
          setActiveDebuff({
            type: payload.type as "ddos" | "flashbang" | "vimLock" | "memoryLeak",
            endsAt: payload.endsAt,
          });
        }
      }

      // If a problem was added (garbage drop or memory leak), update queue
      if (payload.addedProblem && playerPrivateState) {
        setPlayerPrivateState({
          ...playerPrivateState,
          queued: [payload.addedProblem, ...playerPrivateState.queued],
        });
      }
    },
    [playerPrivateState]
  );

  const handleEventLogAppend = useCallback(
    (payload: { entry: EventLogEntry }) => {
      setEventLog((prev) => [...prev, payload.entry]);
    },
    []
  );

  const handleSpectateState = useCallback(
    (payload: { spectating: SpectateView | null }) => {
      setSpectateState(payload.spectating);
    },
    []
  );

  const handleCodeUpdate = useCallback(
    (payload: {
      playerId: string;
      problemId: string;
      code: string;
      codeVersion: number;
    }) => {
      // If we're spectating this player, update the spectate view
      if (spectateState && spectateState.playerId === payload.playerId) {
        setSpectateState({
          ...spectateState,
          code: payload.code,
          codeVersion: payload.codeVersion,
        });
      }
    },
    [spectateState]
  );

  const handleMatchEnd = useCallback(
    (payload: {
      matchId: string;
      endReason: string;
      winnerPlayerId: string;
    }) => {
      setMatchPhase("ended");
    },
    []
  );

  const handleError = useCallback((payload: { code: string; message: string }) => {
    console.error("WebSocket error:", payload.code, payload.message);
    // Could show a toast notification here
  }, []);

  // Initialize WebSocket connection
  const ws = useWebSocket({
    wsUrl,
    playerId,
    playerToken,
    onRoomSnapshot: handleRoomSnapshot,
    onSettingsUpdate: handleSettingsUpdate,
    onMatchStarted: handleMatchStarted,
    onMatchPhaseUpdate: handleMatchPhaseUpdate,
    onPlayerUpdate: handlePlayerUpdate,
    onJudgeResult: handleJudgeResult,
    onStackUpdate: handleStackUpdate,
    onChatAppend: handleChatAppend,
    onAttackReceived: handleAttackReceived,
    onEventLogAppend: handleEventLogAppend,
    onSpectateState: handleSpectateState,
    onCodeUpdate: handleCodeUpdate,
    onMatchEnd: handleMatchEnd,
    onError: handleError,
  });

  // Action helpers that use current state
  const runCode = useCallback(
    async (code: string) => {
      if (currentProblem) {
        await ws.runCode(currentProblem.problemId, code);
      }
    },
    [ws, currentProblem]
  );

  const submitCode = useCallback(
    async (code: string) => {
      if (currentProblem) {
        await ws.submitCode(currentProblem.problemId, code);
      }
    },
    [ws, currentProblem]
  );

  const updateCode = useCallback(
    (code: string, version: number) => {
      if (currentProblem) {
        ws.updateCode(currentProblem.problemId, code, version);
      }
    },
    [ws, currentProblem]
  );

  const value: GameStateContextValue = {
    // Connection state
    isConnected: ws.isConnected,

    // Room state
    roomId,
    serverTime,
    playersPublic,
    roomSettings,
    matchPhase,
    matchEndAt,

    // Player state
    playerId,
    username,
    isHost,
    playerPrivateState,
    currentProblem,
    problemStack,
    activeDebuff,
    score,
    solveStreak,
    targetingMode,

    // Spectator state
    spectateState,

    // Chat and logs
    chat,
    eventLog,
    lastJudgeResult,

    // Shop
    shopCatalog,

    // Actions
    sendChat: ws.sendChat,
    runCode,
    submitCode,
    purchaseItem: ws.spendPoints,
    setTargetMode: ws.setTargetMode,
    spectatePlayer: ws.spectatePlayer,
    stopSpectate: ws.stopSpectate,
    updateCode,
    updateSettings: ws.updateSettings,
    startMatch: ws.startMatch,
    addBots: ws.addBots,
    returnToLobby: ws.returnToLobby,
  };

  return (
    <GameStateContext.Provider value={value}>
      {children}
    </GameStateContext.Provider>
  );
}

export function useGameState() {
  const context = useContext(GameStateContext);
  if (context === undefined) {
    throw new Error("useGameState must be used within a GameStateProvider");
  }
  return context;
}
