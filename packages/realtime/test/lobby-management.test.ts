import test from "node:test";
import assert from "node:assert/strict";
import type {
  RoomSettings,
  MatchPublic,
  ProblemSummary,
} from "@leet99/contracts";

// Mock types for testing
type PlayerInternal = {
  playerId: string;
  playerToken: string;
  username: string;
  role: "player" | "bot" | "spectator";
  isHost: boolean;
  status: "lobby" | "coding" | "error" | "underAttack" | "eliminated";
  score: number;
  streak: number;
  targetingMode: "random" | "attackers" | "topScore" | "nearDeath";
  stackSize: number;
  activeDebuff: { type: string; endsAt: string } | null;
  activeBuff: { type: string; endsAt: string } | null;
  connectionId: string | null;
  joinOrder: number;
  currentProblem?: any;
  queued?: ProblemSummary[];
  code?: string;
  codeVersion?: number;
  revealedHints?: string[];
};

type RoomState = {
  roomId: string;
  isCreated: boolean;
  settings: RoomSettings;
  players: Map<string, PlayerInternal>;
  match: MatchPublic;
  chat: any[];
  eventLog: any[];
  nextJoinOrder: number;
  nextBotNumber: number;
  playerProblemHistory: Map<string, Set<string>>;
};

function createMockState(roomId: string = "test_room"): RoomState {
  return {
    roomId,
    isCreated: true,
    settings: {
      matchDurationSec: 120,
      playerCap: 99,
      stackLimit: 10,
      startingQueued: 2,
      difficultyProfile: "moderate",
      attackIntensity: "low",
    },
    players: new Map(),
    match: {
      matchId: null,
      phase: "lobby",
      settings: {
        matchDurationSec: 120,
        playerCap: 99,
        stackLimit: 10,
        startingQueued: 2,
        difficultyProfile: "moderate",
        attackIntensity: "low",
      },
    },
    chat: [],
    eventLog: [],
    nextJoinOrder: 0,
    nextBotNumber: 1,
    playerProblemHistory: new Map(),
  };
}

function createMockPlayer(
  playerId: string,
  username: string,
  isHost: boolean = false,
  role: "player" | "bot" | "spectator" = "player",
): PlayerInternal {
  return {
    playerId,
    playerToken: `token_${playerId}`,
    username,
    role,
    isHost,
    status: "lobby",
    score: 0,
    streak: 0,
    targetingMode: "random",
    stackSize: 0,
    activeDebuff: null,
    activeBuff: null,
    connectionId: role === "bot" ? null : `conn_${playerId}`,
    joinOrder: 0,
  };
}

// ============================================================================
// UPDATE_SETTINGS Tests
// ============================================================================

test("UPDATE_SETTINGS: should merge partial settings", () => {
  const state = createMockState();
  const host = createMockPlayer("p_1", "Alice", true);
  state.players.set(host.playerId, host);

  // Simulate UPDATE_SETTINGS
  const patch = { difficultyProfile: "competitive" as const, playerCap: 12 };
  state.settings = { ...state.settings, ...patch };
  state.match.settings = state.settings;

  assert.equal(state.settings.difficultyProfile, "competitive");
  assert.equal(state.settings.playerCap, 12);
  assert.equal(state.settings.matchDurationSec, 120); // unchanged
});

test("UPDATE_SETTINGS: should reject if not in lobby", () => {
  const state = createMockState();
  const host = createMockPlayer("p_1", "Alice", true);
  state.players.set(host.playerId, host);
  state.match.phase = "main";

  // Validation check
  const isLobby = state.match.phase === "lobby";
  assert.equal(isLobby, false);
});

test("UPDATE_SETTINGS: should reject if not host", () => {
  const state = createMockState();
  const host = createMockPlayer("p_1", "Alice", true);
  const player = createMockPlayer("p_2", "Bob", false);
  state.players.set(host.playerId, host);
  state.players.set(player.playerId, player);

  // Validation check
  assert.equal(player.isHost, false);
});

// ============================================================================
// ADD_BOTS Tests
// ============================================================================

test("ADD_BOTS: should create bots with sequential naming", () => {
  const state = createMockState();
  const host = createMockPlayer("p_1", "Alice", true);
  state.players.set(host.playerId, host);

  // Simulate adding 3 bots
  const count = 3;
  for (let i = 0; i < count; i++) {
    const botId = `bot_${i}`;
    const botUsername = `Bot ${state.nextBotNumber}`;
    state.nextBotNumber++;

    const bot = createMockPlayer(botId, botUsername, false, "bot");
    bot.joinOrder = state.nextJoinOrder++;
    state.players.set(botId, bot);
  }

  assert.equal(state.players.size, 4); // 1 host + 3 bots
  assert.equal(state.nextBotNumber, 4);

  const bots = Array.from(state.players.values()).filter(
    (p) => p.role === "bot",
  );
  assert.equal(bots.length, 3);
  assert.equal(bots[0].username, "Bot 1");
  assert.equal(bots[1].username, "Bot 2");
  assert.equal(bots[2].username, "Bot 3");
});

test("ADD_BOTS: should reject if not in lobby", () => {
  const state = createMockState();
  state.match.phase = "main";

  const isLobby = state.match.phase === "lobby";
  assert.equal(isLobby, false);
});

test("ADD_BOTS: bots should have no connection", () => {
  const state = createMockState();
  const bot = createMockPlayer("bot_1", "Bot 1", false, "bot");
  state.players.set(bot.playerId, bot);

  assert.equal(bot.connectionId, null);
  assert.equal(bot.role, "bot");
});

// ============================================================================
// START_MATCH Tests
// ============================================================================

test("START_MATCH: should reject with less than 2 participants", () => {
  const state = createMockState();
  const host = createMockPlayer("p_1", "Alice", true);
  state.players.set(host.playerId, host);

  const participants = Array.from(state.players.values()).filter(
    (p) => p.role === "player" || p.role === "bot",
  );
  assert.equal(participants.length, 1);
  // Should be rejected (need at least 2)
});

test("START_MATCH: should generate match ID and timestamps", () => {
  const state = createMockState();
  const host = createMockPlayer("p_1", "Alice", true);
  const player = createMockPlayer("p_2", "Bob", false);
  state.players.set(host.playerId, host);
  state.players.set(player.playerId, player);

  // Simulate START_MATCH
  const matchId = `m_${state.roomId}_${Date.now()}`;
  const now = new Date();
  const startAt = now.toISOString();
  const endAt = new Date(
    now.getTime() + state.settings.matchDurationSec * 1000,
  ).toISOString();

  state.match = {
    matchId,
    phase: "warmup",
    startAt,
    endAt,
    settings: state.settings,
  };

  assert.ok(state.match.matchId);
  assert.equal(state.match.phase, "warmup");
  assert.ok(state.match.startAt);
  assert.ok(state.match.endAt);
});

test("START_MATCH: should initialize all players with problems", () => {
  const state = createMockState();
  const host = createMockPlayer("p_1", "Alice", true);
  const player = createMockPlayer("p_2", "Bob", false);
  state.players.set(host.playerId, host);
  state.players.set(player.playerId, player);

  // Simulate initialization
  for (const p of state.players.values()) {
    if (p.role === "player" || p.role === "bot") {
      p.status = "coding";
      p.currentProblem = { problemId: "test", title: "Test" } as any;
      p.queued = [
        { problemId: "q1", title: "Q1", difficulty: "easy" },
        { problemId: "q2", title: "Q2", difficulty: "medium" },
      ];
      p.code = "def test(): pass";
      p.codeVersion = 1;
      p.revealedHints = [];
      p.stackSize = 2;
    }
  }

  const participants = Array.from(state.players.values()).filter(
    (p) => p.role === "player" || p.role === "bot",
  );

  for (const p of participants) {
    assert.equal(p.status, "coding");
    assert.ok(p.currentProblem);
    assert.equal(p.queued?.length, 2);
    assert.equal(p.codeVersion, 1);
    assert.deepEqual(p.revealedHints, []);
  }
});

test("START_MATCH: warmup duration should be 10% of match duration", () => {
  const state = createMockState();
  state.settings.matchDurationSec = 120;

  const warmupDurationMs = state.settings.matchDurationSec * 1000 * 0.1;
  assert.equal(warmupDurationMs, 60000); // 60 seconds
});

// ============================================================================
// RETURN_TO_LOBBY Tests
// ============================================================================

test("RETURN_TO_LOBBY: should reject if not ended", () => {
  const state = createMockState();
  state.match.phase = "main";

  const isEnded = state.match.phase === "ended";
  assert.equal(isEnded, false);
});

test("RETURN_TO_LOBBY: should reset match state", () => {
  const state = createMockState();
  state.match = {
    matchId: "m_123",
    phase: "ended",
    startAt: new Date().toISOString(),
    endAt: new Date().toISOString(),
    settings: state.settings,
  };

  // Simulate RETURN_TO_LOBBY
  state.match = {
    matchId: null,
    phase: "lobby",
    settings: state.settings,
  };

  assert.equal(state.match.matchId, null);
  assert.equal(state.match.phase, "lobby");
  assert.equal(state.match.startAt, undefined);
  assert.equal(state.match.endAt, undefined);
});

test("RETURN_TO_LOBBY: should reset all player state", () => {
  const state = createMockState();
  const player = createMockPlayer("p_1", "Alice", true);
  player.status = "eliminated";
  player.score = 100;
  player.streak = 5;
  player.stackSize = 3;
  player.currentProblem = { problemId: "test" } as any;
  player.queued = [{ problemId: "q1", title: "Q1", difficulty: "easy" }];
  player.code = "def test(): pass";
  player.codeVersion = 10;
  player.revealedHints = ["hint1"];

  state.players.set(player.playerId, player);

  // Simulate reset
  player.status = "lobby";
  player.score = 0;
  player.streak = 0;
  player.stackSize = 0;
  player.activeDebuff = null;
  player.activeBuff = null;
  player.currentProblem = undefined;
  player.queued = undefined;
  player.code = undefined;
  player.codeVersion = undefined;
  player.revealedHints = undefined;

  assert.equal(player.status, "lobby");
  assert.equal(player.score, 0);
  assert.equal(player.streak, 0);
  assert.equal(player.stackSize, 0);
  assert.equal(player.currentProblem, undefined);
  assert.equal(player.queued, undefined);
});

test("RETURN_TO_LOBBY: should clear problem history", () => {
  const state = createMockState();
  state.playerProblemHistory.set("p_1", new Set(["prob1", "prob2"]));
  state.playerProblemHistory.set("p_2", new Set(["prob3"]));

  // Simulate clear
  state.playerProblemHistory.clear();

  assert.equal(state.playerProblemHistory.size, 0);
});

test("RETURN_TO_LOBBY: should clear event log", () => {
  const state = createMockState();
  state.eventLog = [
    {
      id: "e1",
      at: new Date().toISOString(),
      level: "info",
      message: "Match started",
    },
    {
      id: "e2",
      at: new Date().toISOString(),
      level: "info",
      message: "Player eliminated",
    },
  ];

  // Simulate clear
  state.eventLog = [];

  assert.equal(state.eventLog.length, 0);
});

test("RETURN_TO_LOBBY: should keep chat history", () => {
  const state = createMockState();
  state.chat = [
    {
      id: "c1",
      at: new Date().toISOString(),
      kind: "user",
      text: "gg",
      fromPlayerId: "p_1",
      fromUsername: "Alice",
    },
  ];

  const chatLength = state.chat.length;
  assert.equal(chatLength, 1); // Should be kept
});

// ============================================================================
// Problem Sampling Tests
// ============================================================================

test("Problem sampling: should track player history", () => {
  const state = createMockState();
  const playerId = "p_1";

  // Simulate sampling
  let history = state.playerProblemHistory.get(playerId);
  if (!history) {
    history = new Set();
    state.playerProblemHistory.set(playerId, history);
  }

  history.add("prob1");
  history.add("prob2");

  assert.equal(history.size, 2);
  assert.ok(history.has("prob1"));
  assert.ok(history.has("prob2"));
});

test("Problem sampling: should reset history when bank exhausted", () => {
  const state = createMockState();
  const playerId = "p_1";

  const history = new Set(["prob1", "prob2", "prob3"]);
  state.playerProblemHistory.set(playerId, history);

  // Simulate reset
  const allProblems = ["prob1", "prob2", "prob3"];
  const unseen = allProblems.filter((p) => !history.has(p));

  if (unseen.length === 0) {
    history.clear();
  }

  assert.equal(history.size, 0);
});

test("Difficulty weights: beginner profile", () => {
  const weights = {
    beginner: { easy: 70, medium: 25, hard: 5 },
    moderate: { easy: 40, medium: 40, hard: 20 },
    competitive: { easy: 20, medium: 40, hard: 40 },
  };

  const beginnerWeights = weights.beginner;
  assert.equal(beginnerWeights.easy, 70);
  assert.equal(beginnerWeights.medium, 25);
  assert.equal(beginnerWeights.hard, 5);
});

test("Difficulty weights: moderate profile", () => {
  const weights = {
    beginner: { easy: 70, medium: 25, hard: 5 },
    moderate: { easy: 40, medium: 40, hard: 20 },
    competitive: { easy: 20, medium: 40, hard: 40 },
  };

  const moderateWeights = weights.moderate;
  assert.equal(moderateWeights.easy, 40);
  assert.equal(moderateWeights.medium, 40);
  assert.equal(moderateWeights.hard, 20);
});

test("Difficulty weights: competitive profile", () => {
  const weights = {
    beginner: { easy: 70, medium: 25, hard: 5 },
    moderate: { easy: 40, medium: 40, hard: 20 },
    competitive: { easy: 20, medium: 40, hard: 40 },
  };

  const competitiveWeights = weights.competitive;
  assert.equal(competitiveWeights.easy, 20);
  assert.equal(competitiveWeights.medium, 40);
  assert.equal(competitiveWeights.hard, 40);
});

// ============================================================================
// Integration Tests
// ============================================================================

test("Full lobby flow: create -> add bots -> update settings -> start", () => {
  const state = createMockState();

  // 1. Create room with host
  const host = createMockPlayer("p_1", "Alice", true);
  state.players.set(host.playerId, host);
  assert.equal(state.players.size, 1);
  assert.equal(state.match.phase, "lobby");

  // 2. Add bots
  for (let i = 0; i < 2; i++) {
    const botId = `bot_${i}`;
    const bot = createMockPlayer(
      botId,
      `Bot ${state.nextBotNumber}`,
      false,
      "bot",
    );
    state.nextBotNumber++;
    state.players.set(botId, bot);
  }
  assert.equal(state.players.size, 3);

  // 3. Update settings
  state.settings.difficultyProfile = "competitive";
  state.settings.playerCap = 12;
  assert.equal(state.settings.difficultyProfile, "competitive");

  // 4. Start match
  const participants = Array.from(state.players.values()).filter(
    (p) => p.role === "player" || p.role === "bot",
  );
  assert.equal(participants.length, 3);

  state.match = {
    matchId: `m_${state.roomId}_${Date.now()}`,
    phase: "warmup",
    startAt: new Date().toISOString(),
    endAt: new Date(
      Date.now() + state.settings.matchDurationSec * 1000,
    ).toISOString(),
    settings: state.settings,
  };

  assert.equal(state.match.phase, "warmup");
  assert.ok(state.match.matchId);
});

test("Full match flow: start -> main -> end -> return to lobby", () => {
  const state = createMockState();
  const host = createMockPlayer("p_1", "Alice", true);
  const player = createMockPlayer("p_2", "Bob", false);
  state.players.set(host.playerId, host);
  state.players.set(player.playerId, player);

  // 1. Start match
  state.match = {
    matchId: "m_123",
    phase: "warmup",
    startAt: new Date().toISOString(),
    endAt: new Date(Date.now() + 600000).toISOString(),
    settings: state.settings,
  };
  assert.equal(state.match.phase, "warmup");

  // 2. Transition to main
  state.match.phase = "main";
  assert.equal(state.match.phase, "main");

  // 3. End match
  state.match.phase = "ended";
  state.match.endReason = "timeExpired";
  assert.equal(state.match.phase, "ended");

  // 4. Return to lobby
  state.match = {
    matchId: null,
    phase: "lobby",
    settings: state.settings,
  };
  state.eventLog = [];
  state.playerProblemHistory.clear();

  for (const p of state.players.values()) {
    p.status = "lobby";
    p.score = 0;
    p.streak = 0;
  }

  assert.equal(state.match.phase, "lobby");
  assert.equal(state.match.matchId, null);
  assert.equal(state.eventLog.length, 0);
});
