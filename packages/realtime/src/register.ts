import type { TargetingMode } from "@leet99/contracts";

export type MatchPhase = "lobby" | "warmup" | "main" | "boss" | "ended";

export type RoomSettings = {
  matchDurationSec: number;
  playerCap: number;
  stackLimit: number;
  startingQueued: number;
  difficultyProfile: "beginner" | "moderate" | "competitive";
  attackIntensity: "low" | "high";
};

export type MatchPublic = {
  matchId: string | null;
  phase: MatchPhase;
  settings: RoomSettings;
};

const DEFAULT_SETTINGS: RoomSettings = {
  matchDurationSec: 120,
  playerCap: 8,
  stackLimit: 10,
  startingQueued: 2,
  difficultyProfile: "moderate",
  attackIntensity: "low",
};

function mergeSettings(
  base: RoomSettings,
  partial: Partial<RoomSettings> | undefined,
): RoomSettings {
  return { ...base, ...(partial ?? {}) };
}

export interface PlayerInternal {
  playerId: string;
  playerToken: string;
  username: string;
  role: "player" | "bot" | "spectator";
  isHost: boolean;
  status: "lobby" | "coding" | "error" | "underAttack" | "eliminated";
  score: number;
  streak: number;
  targetingMode: TargetingMode;
  stackSize: number;
  activeDebuff: { type: string; endsAt: string } | null;
  activeBuff: { type: string; endsAt: string } | null;
  connectionId: string | null;
  joinOrder: number;
  // Private state (only during match)
  currentProblem?: import("@leet99/contracts").ProblemClientView | null;
  queued?: import("@leet99/contracts").ProblemSummary[];
  code?: string;
  codeVersion?: number;
  revealedHints?: string[];
}

export interface RoomState {
  roomId: string;
  isCreated: boolean;
  settings: RoomSettings;
  players: Map<string, PlayerInternal>;
  match: MatchPublic;
  chat: unknown[];
  eventLog: unknown[];
  nextJoinOrder: number;
  nextBotNumber?: number;
  playerProblemHistory?: Map<string, Set<string>>;
}

export type PartyRegisterRequest = {
  playerId: string;
  playerToken: string;
  username: string;
  role: "player" | "spectator";
  isHost: boolean;
  settings?: Partial<RoomSettings>;
  allowLateJoin?: boolean;
};

export type PartyRegisterResponse = {
  roomId: string;
  settings: RoomSettings;
  phase: MatchPublic["phase"];
  counts: {
    players: number;
    spectators: number;
  };
};

export type RegisterErrorCode =
  | "ROOM_NOT_FOUND"
  | "ROOM_FULL"
  | "USERNAME_TAKEN"
  | "MATCH_ALREADY_STARTED"
  | "BAD_REQUEST";

export type RegisterResult =
  | { ok: true; response: PartyRegisterResponse }
  | { ok: false; error: { code: RegisterErrorCode; message: string } };

export function createEmptyRoomState(roomId: string): RoomState {
  const settings = { ...DEFAULT_SETTINGS };
  return {
    roomId,
    isCreated: false,
    settings,
    players: new Map(),
    match: {
      matchId: null,
      phase: "lobby",
      settings,
    },
    chat: [],
    eventLog: [],
    nextJoinOrder: 0,
  };
}

function normalizeUsername(username: string): string {
  return username.trim().toLocaleLowerCase();
}

function countHumans(state: RoomState) {
  let players = 0;
  let spectators = 0;

  for (const p of state.players.values()) {
    if (p.role === "player") players += 1;
    if (p.role === "spectator") spectators += 1;
  }

  return { players, spectators };
}

function makeError(code: RegisterErrorCode, message: string): RegisterResult {
  return { ok: false, error: { code, message } };
}

export function applyPartyRegister(
  state: RoomState,
  req: PartyRegisterRequest,
): RegisterResult {
  if (!req.playerId || !req.playerToken || !req.username) {
    return makeError("BAD_REQUEST", "Missing required fields");
  }

  if (!state.isCreated) {
    if (!req.isHost) {
      return makeError("ROOM_NOT_FOUND", "Room not found");
    }

    state.isCreated = true;

    if (req.settings) {
      const nextSettings = mergeSettings(state.settings, req.settings);
      state.settings = nextSettings;
      state.match.settings = nextSettings;
    }
  }

  const desiredUsername = normalizeUsername(req.username);
  for (const p of state.players.values()) {
    if (normalizeUsername(p.username) === desiredUsername) {
      return makeError("USERNAME_TAKEN", "Username is taken");
    }
  }

  const isLobby = state.match.phase === "lobby";
  const allowLateJoin = req.allowLateJoin === true;

  if (req.role === "player" && !isLobby) {
    if (!allowLateJoin || state.match.phase === "ended") {
      return makeError("MATCH_ALREADY_STARTED", "Match already started");
    }
  }

  const countsBefore = countHumans(state);
  if (
    req.role === "player" &&
    countsBefore.players >= state.settings.playerCap
  ) {
    return makeError("ROOM_FULL", "Room is full");
  }

  const playerStatus = isLobby
    ? "lobby"
    : req.role === "player"
      ? "coding"
      : "lobby";

  const player: PlayerInternal = {
    playerId: req.playerId,
    playerToken: req.playerToken,
    username: req.username,
    role: req.role,
    isHost: req.isHost,
    status: playerStatus,
    score: 0,
    streak: 0,
    targetingMode: "random",
    stackSize: 0,
    activeDebuff: null,
    activeBuff: null,
    connectionId: null,
    joinOrder: state.nextJoinOrder++,
    // Private state (initialized during match start)
    currentProblem: undefined,
    queued: undefined,
    code: undefined,
    codeVersion: undefined,
    revealedHints: undefined,
  };

  state.players.set(req.playerId, player);

  const countsAfter = countHumans(state);

  return {
    ok: true,
    response: {
      roomId: state.roomId,
      settings: state.settings,
      phase: state.match.phase,
      counts: countsAfter,
    },
  };
}
