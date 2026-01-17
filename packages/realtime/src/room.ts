import type * as Party from "partykit/server";
import type {
  AttackType,
  ChatMessage,
  ClientMessageType,
  CodeUpdateClientPayload,
  DebuffType,
  ErrorPayload,
  EventLogEntry,
  HttpErrorResponse,
  JoinRoomPayload,
  JudgeResult,
  MatchEndReason,
  MatchPhase,
  MatchPublic,
  PlayerPrivateState,
  PlayerPublic,
  ProblemClientView,
  ProblemFull,
  ProblemSummary,
  RoomSettings,
  RoomSnapshotPayload,
  RunCodePayload,
  SetTargetModePayload,
  ShopItem,
  SpectateView,
  SpendPointsPayload,
  StandingEntry,
  SubmitCodePayload,
  TargetingMode,
  WSMessage,
} from "@leet99/contracts";
import {
  DEFAULT_SHOP_CATALOG,
  PartyRegisterRequestSchema,
  PartyRegisterResponseSchema,
  ProblemFullSchema,
  RoomSettingsSchema,
} from "@leet99/contracts";
import { randomUUID } from "node:crypto";

import { applyPartyRegister } from "./register.ts";
import PROBLEMS_DATA from "./problems.json" with { type: "json" };
import { saveMatch, type MatchPlayerEntry } from "@leet99/supabase";

// ============================================================================
// Rate Limiting Constants (per spec section 6)
// ============================================================================

const RATE_LIMITS = {
  RUN_CODE: { intervalMs: 2000, maxRequests: 1 },
  SUBMIT_CODE: { intervalMs: 3000, maxRequests: 1 },
  CODE_UPDATE: { intervalMs: 100, maxRequests: 10 }, // 10 per second
  SPECTATE_PLAYER: { intervalMs: 1000, maxRequests: 1 },
  SEND_CHAT: { intervalMs: 500, maxRequests: 2 }, // 2 per second
};

const CODE_MAX_BYTES = 50000;

// ============================================================================
// Attack Durations (per spec section 8.6)
// ============================================================================

const BASE_DEBUFF_DURATIONS: Record<DebuffType, number> = {
  ddos: 12000, // 12s
  flashbang: 25000, // 25s
  vimLock: 12000, // 12s
  memoryLeak: 30000, // 30s
};

const DEBUFF_GRACE_PERIOD_MS = 5000; // 5s immunity after debuff ends

const DEBUG_TIMERS = true;

// ============================================================================
// Scoring Constants (per spec section 8.2)
// ============================================================================
 
const DIFFICULTY_SCORES: Record<"easy" | "medium" | "hard", number> = {
  easy: 5,
  medium: 10,
  hard: 20,
};

// ============================================================================
// Room State Types
// ============================================================================

interface RateLimitState {
  lastRequestAt: number;
  requestCount: number;
}

interface PlayerInternal {
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
  activeDebuff: { type: DebuffType; endsAt: string } | null;
  activeBuff: { type: "rateLimiter"; endsAt: string } | null;
  connectionId: string | null;
  joinOrder: number;
  // Private state (only during match)
  currentProblem?: ProblemClientView | null;
  queued?: ProblemSummary[];
  code?: string;
  codeVersion?: number;
  revealedHints?: string[];
  lastProblemArrivalAt?: number; // Timestamp of last problem arrival (for per-player timing)
  // Rate limiting
  rateLimits?: Map<string, RateLimitState>;
  // Attack tracking
  recentAttackers?: Map<string, number>; // playerId -> lastAttackedAt timestamp
  // Debuff grace period
  debuffGraceEndsAt?: number;
  // Shop cooldowns
  shopCooldowns?: Map<ShopItem, number>; // item -> cooldown ends at
  // Spectating
  spectatingPlayerId?: string | null;
  // Bot simulation
  nextBotActionAt?: number;
  // Elimination tracking
  eliminatedAt?: string | null;
}

interface RoomState {
  roomId: string;
  isCreated: boolean;
  settings: RoomSettings;
  players: Map<string, PlayerInternal>;
  match: MatchPublic;
  chat: ChatMessage[];
  eventLog: EventLogEntry[];
  nextJoinOrder: number;
  nextBotNumber: number;
  playerProblemHistory: Map<string, Set<string>>;
  nextProblemArrivalAt: number | null; // Timestamp for next problem arrival
  nextBotActionAt: number | null; // Timestamp for next bot action
}

// ============================================================================
// Judge Configuration (from environment)
// ============================================================================

interface JudgeConfig {
  judge0Url: string;
  judge0ApiKey: string;
  rapidApiHost?: string;
  pythonLanguageId?: number;
}

function getJudgeConfig(): JudgeConfig | null {
  const judge0Url = process.env.JUDGE0_URL;
  const judge0ApiKey = process.env.JUDGE0_API_KEY;
  if (!judge0Url || !judge0ApiKey) {
    return null;
  }
  return {
    judge0Url,
    judge0ApiKey,
    rapidApiHost: process.env.JUDGE0_RAPIDAPI_HOST,
    pythonLanguageId: process.env.JUDGE0_PYTHON_LANGUAGE_ID
      ? parseInt(process.env.JUDGE0_PYTHON_LANGUAGE_ID, 10)
      : undefined,
  };
}

// ============================================================================
// PartyKit Room Server
// ============================================================================

export default class Room implements Party.Server {
  readonly room: Party.Room;
  private state: RoomState;

  constructor(room: Party.Room) {
    this.room = room;
    this.state = {
      roomId: room.id,
      isCreated: false,
      settings: RoomSettingsSchema.parse({}),
      players: new Map(),
      match: {
        matchId: null,
        phase: "lobby",
        settings: RoomSettingsSchema.parse({}),
      },
      chat: [],
      eventLog: [],
      nextJoinOrder: 0,
      nextBotNumber: 1,
      playerProblemHistory: new Map(),
      nextProblemArrivalAt: null,
      nextBotActionAt: null,
    };
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  async onStart() {
    // Load persisted state if available
    const stored = await this.room.storage.get<RoomState>("state");
    if (stored) {
      this.state = {
        ...stored,
        isCreated:
          (stored as unknown as { isCreated?: boolean }).isCreated ?? true,
        players: new Map(
          Object.entries(
            stored.players as unknown as Record<string, PlayerInternal>,
          ),
        ),
        nextBotNumber: (stored as any).nextBotNumber ?? 1,
        playerProblemHistory: new Map(
          Object.entries((stored as any).playerProblemHistory ?? {}).map(
            ([k, v]) => [k, new Set(v as string[])],
          ),
        ),
        nextProblemArrivalAt: (stored as any).nextProblemArrivalAt ?? null,
        nextBotActionAt: (stored as any).nextBotActionAt ?? null,
      };

      // Restore Maps for players
      for (const player of this.state.players.values()) {
        if (player.rateLimits) {
          player.rateLimits = new Map(
            Object.entries(player.rateLimits as unknown as Record<string, RateLimitState>),
          );
        }
        if (player.recentAttackers) {
          player.recentAttackers = new Map(
            Object.entries(player.recentAttackers as unknown as Record<string, number>),
          );
        }
        if (player.shopCooldowns) {
          player.shopCooldowns = new Map(
            Object.entries(player.shopCooldowns as unknown as Record<string, number>).map(
              ([k, v]) => [k as ShopItem, v] as const,
            ),
          );
        }
      }

      // Initialize lastProblemArrivalAt for players if missing (for restored state)
      const now = Date.now();
      for (const player of this.state.players.values()) {
        if (
          (player.role === "player" || player.role === "bot") &&
          !player.lastProblemArrivalAt &&
          this.state.match.phase !== "lobby" &&
          this.state.match.phase !== "ended"
        ) {
          // Initialize to match start time if available, otherwise use now
          player.lastProblemArrivalAt = this.state.match.startAt
            ? new Date(this.state.match.startAt).getTime()
            : now;
        }
      }

      // Reschedule alarms if match is active
      if (
        this.state.match.phase !== "lobby" &&
        this.state.match.phase !== "ended"
      ) {
        // Reschedule problem arrivals if needed
        if (this.state.nextProblemArrivalAt) {
          if (this.state.nextProblemArrivalAt > now) {
            // Still in the future, reschedule (recalculates based on current player states)
            await this.scheduleNextProblemArrival();
          } else {
            // Past due, handle immediately
            await this.handleProblemArrivals();
          }
        } else {
          // No arrival scheduled, schedule one
          await this.scheduleNextProblemArrival();
        }

        // Reschedule bot actions
        await this.scheduleBotActions();
      }
    }
  }

  async onConnect(conn: Party.Connection, _ctx: Party.ConnectionContext) {
    // Connection established, wait for JOIN_ROOM message
    console.log(`[${this.state.roomId}] Connection opened: ${conn.id}`);
  }

  async onClose(conn: Party.Connection) {
    // Find and update the player who disconnected
    for (const player of this.state.players.values()) {
      if (player.connectionId === conn.id) {
        player.connectionId = null;
        console.log(
          `[${this.state.roomId}] Player disconnected: ${player.username}`,
        );

        // Check if we need to transfer host
        if (player.isHost) {
          this.transferHost();
        }

        // Broadcast updated player state
        this.broadcastPlayerUpdate(player);
        break;
      }
    }
  }

  async onMessage(message: string, sender: Party.Connection) {
    console.log(`[Room ${this.state.roomId}][RX] ${message.slice(0, 100)}`);
    try {
      const parsed = JSON.parse(message) as WSMessage<
        ClientMessageType,
        unknown
      >;

      switch (parsed.type) {
        case "JOIN_ROOM":
          await this.handleJoinRoom(
            sender,
            parsed.payload as JoinRoomPayload,
            parsed.requestId,
          );
          break;

        case "SEND_CHAT":
          await this.handleSendChat(
            sender,
            parsed.payload as { text: string },
            parsed.requestId,
          );
          break;

        case "UPDATE_SETTINGS":
          await this.handleUpdateSettings(
            sender,
            parsed.payload as { patch: Partial<RoomSettings> },
            parsed.requestId,
          );
          break;

        case "START_MATCH":
          await this.handleStartMatch(sender, parsed.requestId);
          break;

        case "ADD_BOTS":
          await this.handleAddBots(
            sender,
            parsed.payload as { count: number },
            parsed.requestId,
          );
          break;

        case "RETURN_TO_LOBBY":
          await this.handleReturnToLobby(sender, parsed.requestId);
          break;

        case "SET_TARGET_MODE":
          await this.handleSetTargetMode(
            sender,
            parsed.payload as SetTargetModePayload,
            parsed.requestId,
          );
          break;

        case "CODE_UPDATE":
          await this.handleCodeUpdate(
            sender,
            parsed.payload as CodeUpdateClientPayload,
            parsed.requestId,
          );
          break;

        case "RUN_CODE":
          await this.handleRunCode(
            sender,
            parsed.payload as RunCodePayload,
            parsed.requestId,
          );
          break;

        case "SUBMIT_CODE":
          await this.handleSubmitCode(
            sender,
            parsed.payload as SubmitCodePayload,
            parsed.requestId,
          );
          break;

        case "SPEND_POINTS":
          await this.handleSpendPoints(
            sender,
            parsed.payload as SpendPointsPayload,
            parsed.requestId,
          );
          break;

        case "SPECTATE_PLAYER":
          await this.handleSpectatePlayer(
            sender,
            parsed.payload as { playerId: string },
            parsed.requestId,
          );
          break;

        case "STOP_SPECTATE":
          await this.handleStopSpectate(sender, parsed.requestId);
          break;

        default:
          this.sendError(
            sender,
            "BAD_REQUEST",
            `Unknown message type: ${parsed.type}`,
            parsed.requestId,
          );
      }
    } catch (err) {
      console.error(`[${this.state.roomId}] Error processing message:`, err);
      if (err instanceof SyntaxError) {
        this.sendError(sender, "BAD_REQUEST", "Invalid JSON message");
      } else {
        const errorMessage =
          err instanceof Error ? err.message : "Internal server error";
        this.sendError(sender, "INTERNAL_ERROR", errorMessage);
      }
    }
  }

  // ============================================================================
  // Rate Limiting
  // ============================================================================

  private checkRateLimit(
    player: PlayerInternal,
    action: keyof typeof RATE_LIMITS,
  ): { allowed: boolean; retryAfterMs?: number } {
    const limit = RATE_LIMITS[action];
    if (!limit) return { allowed: true };

    if (!player.rateLimits) {
      player.rateLimits = new Map();
    }

    const now = Date.now();
    const state = player.rateLimits.get(action);

    if (!state) {
      player.rateLimits.set(action, { lastRequestAt: now, requestCount: 1 });
      return { allowed: true };
    }

    const elapsed = now - state.lastRequestAt;

    if (elapsed >= limit.intervalMs) {
      // Reset window
      state.lastRequestAt = now;
      state.requestCount = 1;
      return { allowed: true };
    }

    if (state.requestCount >= limit.maxRequests) {
      const retryAfterMs = limit.intervalMs - elapsed;
      return { allowed: false, retryAfterMs };
    }

    state.requestCount++;
    return { allowed: true };
  }

  // ============================================================================
  // Message Handlers
  // ============================================================================

  private async handleJoinRoom(
    conn: Party.Connection,
    payload: JoinRoomPayload,
    requestId?: string,
  ) {
    const { playerToken } = payload;

    // Find player by token
    let player: PlayerInternal | undefined;
    for (const p of this.state.players.values()) {
      if (p.playerToken === playerToken) {
        player = p;
        break;
      }
    }

    if (!player) {
      // Token not found - this could be a new player from HTTP API
      // In production, we'd validate against a shared store
      // For now, reject with UNAUTHORIZED
      this.sendError(conn, "UNAUTHORIZED", "Invalid player token", requestId);
      conn.close();
      return;
    }

    // Update connection
    player.connectionId = conn.id;

    // Ensure there is a connected host; if not, promote the earliest connected player.
    const connectedHost = Array.from(this.state.players.values()).find(
      (p) => p.isHost && p.connectionId,
    );
    if (!connectedHost) {
      let newHost: PlayerInternal | undefined;
      for (const p of this.state.players.values()) {
        if (
          p.role === "player" &&
          p.connectionId &&
          (!newHost || p.joinOrder < newHost.joinOrder)
        ) {
          newHost = p;
        }
      }

      if (newHost) {
        const previousHost = Array.from(this.state.players.values()).find(
          (p) => p.isHost,
        );
        for (const p of this.state.players.values()) {
          p.isHost = p === newHost;
        }
        if (!previousHost || previousHost.playerId !== newHost.playerId) {
          this.addSystemChat(`${newHost.username} is now the host`);
        }
        this.broadcastPlayerUpdate(newHost);
      }
    }

    // Send ROOM_SNAPSHOT
    const snapshot = this.buildRoomSnapshot(player);
    const msg: WSMessage<"ROOM_SNAPSHOT", RoomSnapshotPayload> = {
      type: "ROOM_SNAPSHOT",
      requestId,
      payload: snapshot,
    };
    conn.send(JSON.stringify(msg));

    // Log join
    console.log(`[${this.state.roomId}] Player joined: ${player.username}`);

    // Add system chat message
    this.addSystemChat(`${player.username} joined the room`);

    // Broadcast updated state to all
    this.broadcastPlayerUpdate(player);
  }

  private async handleSendChat(
    conn: Party.Connection,
    payload: { text: string },
    requestId?: string,
  ) {
    // Find player by connection
    const player = this.findPlayerByConnection(conn.id);
    if (!player) {
      this.sendError(conn, "UNAUTHORIZED", "Not authenticated", requestId);
      return;
    }

    // Rate limit check
    const rateCheck = this.checkRateLimit(player, "SEND_CHAT");
    if (!rateCheck.allowed) {
      this.sendError(conn, "RATE_LIMITED", "Too many chat messages", requestId, rateCheck.retryAfterMs);
      return;
    }

    // Only allow chat in lobby phase
    if (this.state.match.phase !== "lobby") {
      this.sendError(
        conn,
        "FORBIDDEN",
        "Chat is only available in lobby",
        requestId,
      );
      return;
    }

    const text = payload.text?.trim();
    if (!text || text.length === 0 || text.length > 200) {
      this.sendError(conn, "BAD_REQUEST", "Invalid chat message", requestId);
      return;
    }

    // Add message
    const chatMsg: ChatMessage = {
      id: `c_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      at: new Date().toISOString(),
      kind: "user",
      text,
      fromPlayerId: player.playerId,
      fromUsername: player.username,
    };
    this.state.chat.push(chatMsg);

    // Keep only last 100 messages
    if (this.state.chat.length > 100) {
      this.state.chat = this.state.chat.slice(-100);
    }

    // Broadcast to all
    this.broadcast({
      type: "CHAT_APPEND",
      payload: { message: chatMsg },
    });
  }

  private async handleUpdateSettings(
    conn: Party.Connection,
    payload: { patch: Partial<RoomSettings> },
    requestId?: string,
  ) {
    // Auth check
    const player = this.findPlayerByConnection(conn.id);
    if (!player) {
      this.sendError(conn, "UNAUTHORIZED", "Not authenticated", requestId);
      return;
    }

    // Host check
    if (!player.isHost) {
      this.sendError(
        conn,
        "FORBIDDEN",
        "Only host can update settings",
        requestId,
      );
      return;
    }

    // Lobby check
    if (this.state.match.phase !== "lobby") {
      this.sendError(
        conn,
        "FORBIDDEN",
        "Can only update settings in lobby",
        requestId,
      );
      return;
    }

    // Validate patch
    const validation = RoomSettingsSchema.partial().safeParse(payload.patch);
    if (!validation.success) {
      this.sendError(conn, "BAD_REQUEST", "Invalid settings", requestId);
      return;
    }

    // Merge settings
    this.state.settings = {
      ...this.state.settings,
      ...validation.data,
    };
    this.state.match.settings = this.state.settings;

    // Persist
    await this.persistState();

    // Broadcast update
    this.broadcast({
      type: "SETTINGS_UPDATE",
      payload: {
        settings: this.state.settings,
      },
    });

    console.log(
      `[${this.state.roomId}] Settings updated by ${player.username}`,
    );
  }

  private async handleStartMatch(conn: Party.Connection, requestId?: string) {
    // Auth check
    const player = this.findPlayerByConnection(conn.id);
    if (!player) {
      this.sendError(conn, "UNAUTHORIZED", "Not authenticated", requestId);
      return;
    }

    // Host check
    if (!player.isHost) {
      this.sendError(conn, "FORBIDDEN", "Only host can start match", requestId);
      return;
    }

    // Lobby check
    if (this.state.match.phase !== "lobby") {
      this.sendError(
        conn,
        "FORBIDDEN",
        "Match already started or ended",
        requestId,
      );
      return;
    }

    // Check we have at least 2 participants (including host)
    const participants = Array.from(this.state.players.values()).filter(
      (p) => p.role === "player" || p.role === "bot",
    );
    if (participants.length < 2) {
      this.sendError(
        conn,
        "BAD_REQUEST",
        "Need at least 2 participants to start",
        requestId,
      );
      return;
    }

    // Generate match ID
    const matchId = `m_${this.state.roomId}_${Date.now()}`;
    const now = new Date();
    const startAt = now.toISOString();
    const endAt = new Date(
      now.getTime() + this.state.settings.matchDurationSec * 1000,
    ).toISOString();

    // Determine initial phase (skip warmup for very short matches)
    const phase: MatchPhase = this.state.settings.matchDurationSec < 10 ? "main" : "warmup";

    // Update match state
    this.state.match = {
      matchId,
      phase,
      startAt,
      endAt,
      settings: this.state.settings,
    };

    // Initialize all players
    for (const p of participants) {
      p.status = "coding";
      p.score = 0;
      p.streak = 0;
      p.stackSize = 0;
      p.activeDebuff = null;
      p.activeBuff = null;
      p.eliminatedAt = null;
      p.recentAttackers = new Map();
      p.debuffGraceEndsAt = undefined;
      p.shopCooldowns = new Map();

      // Sample initial problems
      const current = this.sampleProblem(p.playerId, true);
      const queued: ProblemSummary[] = [];
      for (let i = 0; i < this.state.settings.startingQueued; i++) {
        const prob = this.sampleProblem(p.playerId, true);
        queued.push({
          problemId: prob.problemId,
          title: prob.title,
          difficulty: prob.difficulty,
          isGarbage: prob.isGarbage,
        });
      }

      p.currentProblem = this.toClientView(current);
      p.queued = queued;
      p.code = current.problemType === "code" ? current.starterCode : "";
      p.codeVersion = 1;
      p.revealedHints = [];
      p.stackSize = queued.length;
      p.lastProblemArrivalAt = now.getTime(); // Initialize to match start time

      // Initialize bot simulation timing
      if (p.role === "bot") {
        p.nextBotActionAt = this.calculateNextBotActionTime(p);
      }
    }

    // Persist
    await this.persistState();

    // Schedule bot actions (sets state only, doesn't set alarm directly)
    await this.scheduleBotActions();

    // Schedule first problem arrival (coordinates all alarms)
    await this.scheduleNextProblemArrival();

    // Broadcast MATCH_STARTED
    this.broadcast({
      type: "MATCH_STARTED",
      payload: {
        match: this.state.match,
      },
    });

    // Send each player their snapshot with private state
    for (const conn of this.room.getConnections()) {
      const p = this.findPlayerByConnection(conn.id);
      if (p) {
        const snapshot = this.buildRoomSnapshot(p);
        conn.send(
          JSON.stringify({
            type: "ROOM_SNAPSHOT",
            payload: snapshot,
          }),
        );
      }
    }

    // Add system chat and event log
    this.addSystemChat("Match started! Good luck!");
    this.addEventLog("info", "Match started");

    console.log(`[${this.state.roomId}] Match started: ${matchId}`);
  }

  private async handleAddBots(
    conn: Party.Connection,
    payload: { count: number },
    requestId?: string,
  ) {
    // Auth check
    const player = this.findPlayerByConnection(conn.id);
    if (!player) {
      this.sendError(conn, "UNAUTHORIZED", "Not authenticated", requestId);
      return;
    }

    // Host check
    if (!player.isHost) {
      this.sendError(conn, "FORBIDDEN", "Only host can add bots", requestId);
      return;
    }

    // Lobby check
    if (this.state.match.phase !== "lobby") {
      this.sendError(
        conn,
        "FORBIDDEN",
        "Can only add bots in lobby",
        requestId,
      );
      return;
    }

    // Validate count
    const count = payload.count;
    if (!Number.isInteger(count) || count < 1 || count > 20) {
      this.sendError(
        conn,
        "BAD_REQUEST",
        "Invalid bot count (must be 1-20)",
        requestId,
      );
      return;
    }

    // Create bots
    const addedBots: string[] = [];
    for (let i = 0; i < count; i++) {
      const botId = `bot_${randomUUID()}`;
      const botUsername = `Bot ${this.state.nextBotNumber}`;
      this.state.nextBotNumber++;

      const bot: PlayerInternal = {
        playerId: botId,
        playerToken: "",
        username: botUsername,
        role: "bot",
        isHost: false,
        status: "lobby",
        score: 0,
        streak: 0,
        targetingMode: "random",
        stackSize: 0,
        activeDebuff: null,
        activeBuff: null,
        connectionId: null,
        joinOrder: this.state.nextJoinOrder++,
      };

      this.state.players.set(botId, bot);
      addedBots.push(botUsername);
    }

    // Persist
    await this.persistState();

    // Send fresh snapshot to all (roster changed)
    for (const conn of this.room.getConnections()) {
      const p = this.findPlayerByConnection(conn.id);
      if (p) {
        const snapshot = this.buildRoomSnapshot(p);
        conn.send(
          JSON.stringify({
            type: "ROOM_SNAPSHOT",
            payload: snapshot,
          }),
        );
      }
    }

    // Add system chat for each bot
    for (const botName of addedBots) {
      this.addSystemChat(`${botName} joined the lobby`);
    }

    console.log(
      `[${this.state.roomId}] Added ${count} bots: ${addedBots.join(", ")}`,
    );
  }

  private async handleReturnToLobby(
    conn: Party.Connection,
    requestId?: string,
  ) {
    // Auth check
    const player = this.findPlayerByConnection(conn.id);
    if (!player) {
      this.sendError(conn, "UNAUTHORIZED", "Not authenticated", requestId);
      return;
    }

    // Host check
    if (!player.isHost) {
      this.sendError(
        conn,
        "FORBIDDEN",
        "Only host can return to lobby",
        requestId,
      );
      return;
    }

    // Ended check
    if (this.state.match.phase !== "ended") {
      this.sendError(
        conn,
        "FORBIDDEN",
        "Can only return to lobby after match ends",
        requestId,
      );
      return;
    }

    // Reset match state
    this.state.match = {
      matchId: null,
      phase: "lobby",
      settings: this.state.settings,
    };

    // Clear problem arrival schedule
    this.state.nextProblemArrivalAt = null;
    this.state.nextBotActionAt = null;

    // Reset all players
    for (const p of this.state.players.values()) {
      p.status = "lobby";
      p.score = 0;
      p.streak = 0;
      p.stackSize = 0;
      p.activeDebuff = null;
      p.activeBuff = null;
      p.currentProblem = undefined;
      p.queued = undefined;
      p.code = undefined;
      p.codeVersion = undefined;
      p.revealedHints = undefined;
      p.lastProblemArrivalAt = undefined;
      p.recentAttackers = undefined;
      p.debuffGraceEndsAt = undefined;
      p.shopCooldowns = undefined;
      p.spectatingPlayerId = undefined;
      p.nextBotActionAt = undefined;
    }

    // Clear problem history and event log
    this.state.playerProblemHistory.clear();
    this.state.eventLog = [];

    // Persist
    await this.persistState();

    // Send fresh snapshot to all
    for (const conn of this.room.getConnections()) {
      const p = this.findPlayerByConnection(conn.id);
      if (p) {
        const snapshot = this.buildRoomSnapshot(p);
        conn.send(
          JSON.stringify({
            type: "ROOM_SNAPSHOT",
            payload: snapshot,
          }),
        );
      }
    }

    // Add system chat
    this.addSystemChat("Returned to lobby");

    console.log(`[${this.state.roomId}] Returned to lobby`);
  }

  private async handleSetTargetMode(
    conn: Party.Connection,
    payload: SetTargetModePayload,
    requestId?: string,
  ) {
    const player = this.findPlayerByConnection(conn.id);
    if (!player) {
      this.sendError(conn, "UNAUTHORIZED", "Not authenticated", requestId);
      return;
    }

    if (player.role !== "player") {
      this.sendError(conn, "FORBIDDEN", "Only players can set target mode", requestId);
      return;
    }

    const validModes: TargetingMode[] = ["random", "attackers", "topScore", "nearDeath", "rankAbove"];
    if (!validModes.includes(payload.mode)) {
      this.sendError(conn, "BAD_REQUEST", "Invalid targeting mode", requestId);
      return;
    }

    player.targetingMode = payload.mode;
    await this.persistState();

    // Broadcast player update
    this.broadcastPlayerUpdate(player);

    console.log(`[${this.state.roomId}] ${player.username} set targeting mode to ${payload.mode}`);
  }

  private async handleCodeUpdate(
    conn: Party.Connection,
    payload: CodeUpdateClientPayload,
    requestId?: string,
  ) {
    const player = this.findPlayerByConnection(conn.id);
    if (!player) {
      this.sendError(conn, "UNAUTHORIZED", "Not authenticated", requestId);
      return;
    }

    if (player.role !== "player") {
      this.sendError(conn, "FORBIDDEN", "Only players can update code", requestId);
      return;
    }

    if (player.status === "eliminated") {
      this.sendError(conn, "PLAYER_ELIMINATED", "You are eliminated", requestId);
      return;
    }

    // Rate limit check
    const rateCheck = this.checkRateLimit(player, "CODE_UPDATE");
    if (!rateCheck.allowed) {
      this.sendError(conn, "RATE_LIMITED", "Too many code updates", requestId, rateCheck.retryAfterMs);
      return;
    }

    // Payload size check
    const codeByteLength = new TextEncoder().encode(payload.code).length;
    if (codeByteLength > CODE_MAX_BYTES) {
      this.sendError(conn, "PAYLOAD_TOO_LARGE", "Code exceeds 50KB limit", requestId);
      return;
    }

    // Version check - ignore out-of-order updates
    if (player.codeVersion && payload.codeVersion <= player.codeVersion) {
      return; // Silently ignore
    }

    // Problem ID check
    if (player.currentProblem?.problemId !== payload.problemId) {
      return; // Silently ignore updates for wrong problem
    }

    // Update code
    player.code = payload.code;
    player.codeVersion = payload.codeVersion;

    // Relay to spectators
    this.relayCodeUpdateToSpectators(player, payload);
  }

  private async handleRunCode(
    conn: Party.Connection,
    payload: RunCodePayload,
    requestId?: string,
  ) {
    const player = this.findPlayerByConnection(conn.id);
    if (!player) {
      this.sendError(conn, "UNAUTHORIZED", "Not authenticated", requestId);
      return;
    }

    if (player.role !== "player") {
      this.sendError(conn, "FORBIDDEN", "Only players can run code", requestId);
      return;
    }

    if (player.status === "eliminated") {
      this.sendError(conn, "PLAYER_ELIMINATED", "You are eliminated", requestId);
      return;
    }

    // Check for ddos debuff
    if (player.activeDebuff?.type === "ddos") {
      const endsAt = new Date(player.activeDebuff.endsAt).getTime();
      const retryAfterMs = Math.max(0, endsAt - Date.now());
      this.sendError(conn, "FORBIDDEN", "Run disabled by DDoS attack", requestId, retryAfterMs);
      return;
    }

    // Rate limit check
    const rateCheck = this.checkRateLimit(player, "RUN_CODE");
    if (!rateCheck.allowed) {
      this.sendError(conn, "RATE_LIMITED", "Too many run requests", requestId, rateCheck.retryAfterMs);
      return;
    }

    // Problem ID check
    if (player.currentProblem?.problemId !== payload.problemId) {
      this.sendError(conn, "PROBLEM_NOT_FOUND", "Wrong problem ID", requestId);
      return;
    }

    // Get full problem
    const problem = this.getFullProblem(payload.problemId);
    if (!problem) {
      this.sendError(conn, "PROBLEM_NOT_FOUND", "Problem not found", requestId);
      return;
    }

    // Run code is only for code problems, not MCQs
    if (problem.problemType === "mcq") {
      this.sendError(conn, "INVALID_PROBLEM_TYPE", "Run code is not available for MCQ problems", requestId);
      return;
    }

    // Get judge config
    const judgeConfig = getJudgeConfig();
    if (!judgeConfig) {
      // No judge configured - simulate result for development
      const result = this.simulateJudgeResult("run", problem, payload.code);
      this.sendJudgeResult(conn, player, result, requestId);
      return;
    }

    // Run public tests via judge
    try {
      const { runPublicTests } = await import("@leet99/judge");
      const result = await runPublicTests(problem, payload.code, judgeConfig);

      // Update player status based on result
      player.status = result.passed ? "coding" : "error";
      this.broadcastPlayerUpdate(player);

      this.sendJudgeResult(conn, player, result, requestId);
    } catch (error) {
      console.error(`[${this.state.roomId}] Judge error:`, error);
      this.sendError(conn, "JUDGE_UNAVAILABLE", "Judge service unavailable", requestId);
    }
  }

  private async handleSubmitCode(
    conn: Party.Connection,
    payload: SubmitCodePayload,
    requestId?: string,
  ) {
    const player = this.findPlayerByConnection(conn.id);
    if (!player) {
      this.sendError(conn, "UNAUTHORIZED", "Not authenticated", requestId);
      return;
    }

    if (player.role !== "player") {
      this.sendError(conn, "FORBIDDEN", "Only players can submit code", requestId);
      return;
    }

    if (player.status === "eliminated") {
      this.sendError(conn, "PLAYER_ELIMINATED", "You are eliminated", requestId);
      return;
    }

    // Rate limit check
    const rateCheck = this.checkRateLimit(player, "SUBMIT_CODE");
    if (!rateCheck.allowed) {
      this.sendError(conn, "RATE_LIMITED", "Too many submit requests", requestId, rateCheck.retryAfterMs);
      return;
    }

    // Problem ID check
    if (player.currentProblem?.problemId !== payload.problemId) {
      this.sendError(conn, "PROBLEM_NOT_FOUND", "Wrong problem ID", requestId);
      return;
    }

    // Get full problem
    const problem = this.getFullProblem(payload.problemId);
    if (!problem) {
      this.sendError(conn, "PROBLEM_NOT_FOUND", "Problem not found", requestId);
      return;
    }

    let result: JudgeResult;

    // Handle MCQ problems separately (no judge service needed)
    if (problem.problemType === "mcq") {
      // For MCQ, payload.code is the selected option ID
      const passed = payload.code === problem.correctAnswer;
      result = {
        kind: "submit",
        problemId: problem.problemId,
        passed,
        publicTests: [], // MCQs don't have test results
        hiddenTestsPassed: passed,
        hiddenFailureMessage: passed ? undefined : "Incorrect answer",
      };
    } else {
      // Code problem - use judge service
      const judgeConfig = getJudgeConfig();
      if (!judgeConfig) {
        // No judge configured - simulate result for development
        result = this.simulateJudgeResult("submit", problem, payload.code);
      } else {
        // Run all tests via judge
        try {
          const { runAllTests } = await import("@leet99/judge");
          result = await runAllTests(problem, payload.code, judgeConfig);
        } catch (error) {
          console.error(`[${this.state.roomId}] Judge error:`, error);
          this.sendError(conn, "JUDGE_UNAVAILABLE", "Judge service unavailable", requestId);
          return;
        }
      }
    }

    // Process submission result
    await this.processSubmissionResult(player, problem, result, requestId);
  }

  private async processSubmissionResult(
    player: PlayerInternal,
    problem: ProblemFull,
    result: JudgeResult,
    requestId?: string,
  ) {
    const conn = this.getPlayerConnection(player);

    if (!result.passed) {
      // Failed submission - reset streak, update status
      player.streak = 0;
      player.status = "error";
      this.broadcastPlayerUpdate(player);

      if (conn) {
        this.sendJudgeResult(conn, player, result, requestId);
      }
      return;
    }

    // Passed submission
    const isGarbage = problem.isGarbage ?? false;

    if (!isGarbage) {
      // Award points based on difficulty
      const points = DIFFICULTY_SCORES[problem.difficulty] || 0;
      player.score += points;
      player.streak += 1;

      // Send attack (unless streak is multiple of 3, then memoryLeak)
      const attackType = this.determineAttackType(problem.difficulty, player.streak);
      await this.sendAttack(player, attackType);

      this.addEventLog(
        "info",
        `${player.username} solved ${problem.title} (+${points}) and sent ${attackType}`,
      );
    } else {
      // Garbage problem - no points, no streak increment, no attack
      this.addEventLog("info", `${player.username} cleared garbage: ${problem.title}`);
    }

    // Advance to next problem
    this.advanceToNextProblem(player);
    player.status = "coding";

    // Broadcast updates
    this.broadcastPlayerUpdate(player);
    this.broadcastStackUpdate(player);

    // Send judge result
    if (conn) {
      this.sendJudgeResult(conn, player, result, requestId);
      // Send updated snapshot with new problem
      const snapshot = this.buildRoomSnapshot(player);
      conn.send(JSON.stringify({ type: "ROOM_SNAPSHOT", payload: snapshot }));
    }

    // Update spectators
    this.updateSpectators(player);

    // Persist
    await this.persistState();

    // Check for match end conditions
    await this.checkMatchEnd();
  }

  private async handleSpendPoints(
    conn: Party.Connection,
    payload: SpendPointsPayload,
    requestId?: string,
  ) {
    const player = this.findPlayerByConnection(conn.id);
    if (!player) {
      this.sendError(conn, "UNAUTHORIZED", "Not authenticated", requestId);
      return;
    }

    if (player.role !== "player") {
      this.sendError(conn, "FORBIDDEN", "Only players can spend points", requestId);
      return;
    }

    if (player.status === "eliminated") {
      this.sendError(conn, "PLAYER_ELIMINATED", "You are eliminated", requestId);
      return;
    }

    const item = payload.item;
    const catalogItem = DEFAULT_SHOP_CATALOG.find((c) => c.item === item);
    if (!catalogItem) {
      this.sendError(conn, "BAD_REQUEST", "Unknown shop item", requestId);
      return;
    }

    // Check score
    if (player.score < catalogItem.cost) {
      this.sendError(conn, "INSUFFICIENT_SCORE", "Not enough points", requestId);
      return;
    }

    // Check cooldown
    if (!player.shopCooldowns) {
      player.shopCooldowns = new Map();
    }
    const cooldownEndsAt = player.shopCooldowns.get(item);
    if (cooldownEndsAt && Date.now() < cooldownEndsAt) {
      const retryAfterMs = cooldownEndsAt - Date.now();
      this.sendError(conn, "ITEM_ON_COOLDOWN", "Item on cooldown", requestId, retryAfterMs);
      return;
    }

    // Apply item effect
    const success = await this.applyShopItem(player, item);
    if (!success) {
      this.sendError(conn, "BAD_REQUEST", "Cannot use this item now", requestId);
      return;
    }

    // Deduct cost
    player.score -= catalogItem.cost;

    // Set cooldown if applicable
    if (catalogItem.cooldownSec) {
      player.shopCooldowns.set(item, Date.now() + catalogItem.cooldownSec * 1000);
    }

    // Broadcast updates
    this.broadcastPlayerUpdate(player);

    // Send updated snapshot
    const snapshot = this.buildRoomSnapshot(player);
    conn.send(JSON.stringify({ type: "ROOM_SNAPSHOT", payload: snapshot }));

    // Update spectators
    this.updateSpectators(player);

    // Persist
    await this.persistState();

    this.addEventLog("info", `${player.username} purchased ${item}`);
    console.log(`[${this.state.roomId}] ${player.username} purchased ${item}`);
  }

  private async applyShopItem(player: PlayerInternal, item: ShopItem): Promise<boolean> {
    switch (item) {
      case "clearDebuff":
        if (!player.activeDebuff) {
          return false; // No debuff to clear
        }
        player.activeDebuff = null;
        player.status = "coding";
        return true;

      case "memoryDefrag":
        // Remove all garbage problems from queue
        if (player.queued) {
          player.queued = player.queued.filter((p) => !p.isGarbage);
          player.stackSize = player.queued.length;
          this.broadcastStackUpdate(player);
        }
        return true;

      case "skipProblem":
        // Advance to next problem without scoring
        player.streak = 0;
        this.advanceToNextProblem(player);
        this.broadcastStackUpdate(player);
        return true;

      case "rateLimiter": {
        // Apply rate limiter buff
        const duration = 30000; // 30s
        player.activeBuff = {
          type: "rateLimiter",
          endsAt: new Date(Date.now() + duration).toISOString(),
        };
        return true;
      }

      case "hint": {
        // Reveal next hint for current problem
        if (!player.currentProblem) {
          return false;
        }
        const fullProblem = this.getFullProblem(player.currentProblem.problemId);
        if (!fullProblem || !fullProblem.hints) {
          return false;
        }
        if (!player.revealedHints) {
          player.revealedHints = [];
        }
        if (player.revealedHints.length >= fullProblem.hints.length) {
          return false; // No more hints
        }
        const nextHint = fullProblem.hints[player.revealedHints.length];
        if (!nextHint) {
          return false;
        }
        player.revealedHints.push(nextHint);
        return true;
      }

      default:
        return false;
    }
  }

  private async handleSpectatePlayer(
    conn: Party.Connection,
    payload: { playerId: string },
    requestId?: string,
  ) {
    const player = this.findPlayerByConnection(conn.id);
    if (!player) {
      this.sendError(conn, "UNAUTHORIZED", "Not authenticated", requestId);
      return;
    }

    // Check spectating permissions
    const canSpectate =
      player.role === "spectator" || player.status === "eliminated";
    if (!canSpectate) {
      this.sendError(conn, "FORBIDDEN", "You cannot spectate while alive", requestId);
      return;
    }

    // Rate limit check
    const rateCheck = this.checkRateLimit(player, "SPECTATE_PLAYER");
    if (!rateCheck.allowed) {
      this.sendError(conn, "RATE_LIMITED", "Too many spectate requests", requestId, rateCheck.retryAfterMs);
      return;
    }

    // Find target player
    const target = this.state.players.get(payload.playerId);
    if (!target) {
      this.sendError(conn, "PLAYER_NOT_FOUND", "Target player not found", requestId);
      return;
    }

    // Can only spectate players/bots, not spectators
    if (target.role === "spectator") {
      this.sendError(conn, "BAD_REQUEST", "Cannot spectate a spectator", requestId);
      return;
    }

    // Set spectating
    player.spectatingPlayerId = payload.playerId;

    // Send spectate state
    const spectateView = this.buildSpectateView(target);
    const msg: WSMessage<"SPECTATE_STATE", { spectating: SpectateView | null }> = {
      type: "SPECTATE_STATE",
      requestId,
      payload: { spectating: spectateView },
    };
    conn.send(JSON.stringify(msg));

    console.log(`[${this.state.roomId}] ${player.username} is now spectating ${target.username}`);
  }

  private async handleStopSpectate(conn: Party.Connection, requestId?: string) {
    const player = this.findPlayerByConnection(conn.id);
    if (!player) {
      this.sendError(conn, "UNAUTHORIZED", "Not authenticated", requestId);
      return;
    }

    player.spectatingPlayerId = null;

    // Send spectate state with null
    const msg: WSMessage<"SPECTATE_STATE", { spectating: SpectateView | null }> = {
      type: "SPECTATE_STATE",
      requestId,
      payload: { spectating: null },
    };
    conn.send(JSON.stringify(msg));
  }

  // ============================================================================
  // Attack System
  // ============================================================================

  private determineAttackType(difficulty: "easy" | "medium" | "hard", streak: number): AttackType {
    // If streak is multiple of 3, send memoryLeak
    if (streak > 0 && streak % 3 === 0) {
      return "memoryLeak";
    }

    switch (difficulty) {
      case "easy":
        return "garbageDrop";
      case "medium":
        return Math.random() < 0.5 ? "flashbang" : "vimLock";
      case "hard":
        return "ddos";
      default:
        return "garbageDrop";
    }
  }

  private async sendAttack(attacker: PlayerInternal, attackType: AttackType) {
    // Find target based on targeting mode
    const target = this.selectTarget(attacker);
    if (!target) {
      return; // No valid target (attacker is last alive)
    }

    // Record attack for "attackers" targeting mode
    if (!target.recentAttackers) {
      target.recentAttackers = new Map();
    }
    target.recentAttackers.set(attacker.playerId, Date.now());

    // Apply attack
    if (attackType === "garbageDrop") {
      // Add garbage problem to queue
      const garbageProblem = this.sampleGarbageProblem();
      const eliminated = this.addProblemToQueue(target, garbageProblem);

      // Send attack received event
      const targetConn = this.getPlayerConnection(target);
      if (targetConn) {
        const msg: WSMessage<"ATTACK_RECEIVED", {
          type: AttackType;
          fromPlayerId: string;
          addedProblem?: ProblemSummary;
        }> = {
          type: "ATTACK_RECEIVED",
          payload: {
            type: "garbageDrop",
            fromPlayerId: attacker.playerId,
            addedProblem: {
              problemId: garbageProblem.problemId,
              title: garbageProblem.title,
              difficulty: garbageProblem.difficulty,
              isGarbage: true,
            },
          },
        };
        targetConn.send(JSON.stringify(msg));
      }

      if (!eliminated) {
        this.broadcastStackUpdate(target);
        this.updateSpectators(target);
      }
    } else {
      // Timed debuff
      const debuffType = attackType as DebuffType;

      // Check grace period
      if (target.debuffGraceEndsAt && Date.now() < target.debuffGraceEndsAt) {
        // Target is immune
        this.addEventLog(
          "info",
          `${target.username} was immune to ${attackType} from ${attacker.username}`,
        );
        return;
      }

      // Calculate duration with intensity scaling
      let duration = BASE_DEBUFF_DURATIONS[debuffType];
      if (this.state.settings.attackIntensity === "high") {
        duration = Math.round(duration * 1.3);
      }

      const endsAt = new Date(Date.now() + duration).toISOString();
      target.activeDebuff = { type: debuffType, endsAt };
      target.status = "underAttack";

      // Schedule debuff expiry
      this.scheduleDebuffExpiry(target, duration);

      // Send attack received event
      const targetConn = this.getPlayerConnection(target);
      if (targetConn) {
        const msg: WSMessage<"ATTACK_RECEIVED", {
          type: AttackType;
          fromPlayerId: string;
          endsAt?: string;
        }> = {
          type: "ATTACK_RECEIVED",
          payload: {
            type: attackType,
            fromPlayerId: attacker.playerId,
            endsAt,
          },
        };
        targetConn.send(JSON.stringify(msg));
      }

      this.broadcastPlayerUpdate(target);
      this.updateSpectators(target);
    }

    this.addEventLog(
      "info",
      `${attacker.username} attacked ${target.username} with ${attackType}`,
    );
  }

  private selectTarget(attacker: PlayerInternal): PlayerInternal | null {
    // Get valid targets: alive, non-spectator, not self
    const validTargets = Array.from(this.state.players.values()).filter(
      (p) =>
        p.playerId !== attacker.playerId &&
        p.role !== "spectator" &&
        p.status !== "eliminated",
    );

    if (validTargets.length === 0) {
      return null;
    }

    switch (attacker.targetingMode) {
      case "random":
        return validTargets[Math.floor(Math.random() * validTargets.length)] ?? null;

      case "attackers": {
        // Find recent attackers (within 20s)
        const now = Date.now();
        const recentAttackers = validTargets.filter((t) => {
          const lastAttacked = attacker.recentAttackers?.get(t.playerId);
          return lastAttacked && now - lastAttacked <= 20000;
        });
        if (recentAttackers.length > 0) {
          return recentAttackers[Math.floor(Math.random() * recentAttackers.length)] ?? null;
        }
        // Fallback to random
        return validTargets[Math.floor(Math.random() * validTargets.length)] ?? null;
      }

      case "topScore": {
        // Find highest score, tie-break randomly
        const maxScore = Math.max(...validTargets.map((t) => t.score));
        const topScorers = validTargets.filter((t) => t.score === maxScore);
        return topScorers[Math.floor(Math.random() * topScorers.length)] ?? null;
      }

      case "nearDeath": {
        // Find highest stackSize/stackLimit ratio, tie-break randomly
        const stackLimit = this.state.settings.stackLimit;
        const ratios = validTargets.map((t) => ({
          player: t,
          ratio: t.stackSize / stackLimit,
        }));
        const maxRatio = Math.max(...ratios.map((r) => r.ratio));
        const nearDeathPlayers = ratios.filter((r) => r.ratio === maxRatio);
        const selected = nearDeathPlayers[Math.floor(Math.random() * nearDeathPlayers.length)];
        return selected?.player ?? null;
      }

      case "rankAbove": {
        // Get all participants (alive and non-spectator)
        const participants = Array.from(this.state.players.values()).filter(
          (p) => p.role !== "spectator" && p.status !== "eliminated",
        );

        // Sort by ranking criteria: score desc, then stackSize asc, then playerId
        const sorted = [...participants].sort((a, b) => {
          if (a.score !== b.score) return b.score - a.score;
          if (a.stackSize !== b.stackSize) return a.stackSize - b.stackSize;
          return a.playerId.localeCompare(b.playerId);
        });

        const myIndex = sorted.findIndex((p) => p.playerId === attacker.playerId);
        if (myIndex > 0) {
          // Player right above me
          return sorted[myIndex - 1] ?? null;
        }
        // If I'm #1, fallback to random (or maybe top score, which is also me)
        // User said "right on top of ranking of you", so if I'm #1 there's no one above.
        // Fallback to random among others.
        return validTargets[Math.floor(Math.random() * validTargets.length)] ?? null;
      }

      default:
        return validTargets[Math.floor(Math.random() * validTargets.length)] ?? null;
    }
  }

  private async scheduleDebuffExpiry(player: PlayerInternal, durationMs: number) {
    // For simplicity, we'll handle debuff expiry in onAlarm
    // The alarm system will check for expired debuffs
    const expiryAt = Date.now() + durationMs;
    if (player.activeDebuff) {
      player.activeDebuff.endsAt = new Date(expiryAt).toISOString();
    }
    await this.scheduleNextAlarm();
  }

  private handleExpiredDebuffs() {
    const now = Date.now();
    for (const player of this.state.players.values()) {
      if (player.activeDebuff) {
        const endsAt = new Date(player.activeDebuff.endsAt).getTime();
        if (now >= endsAt) {
          player.activeDebuff = null;
          player.debuffGraceEndsAt = now + DEBUFF_GRACE_PERIOD_MS;
          if (player.status === "underAttack") {
            player.status = "coding";
          }
          this.broadcastPlayerUpdate(player);
          this.updateSpectators(player);
        }
      }

      // Also check buff expiry
      if (player.activeBuff) {
        const endsAt = new Date(player.activeBuff.endsAt).getTime();
        if (now >= endsAt) {
          player.activeBuff = null;
          this.broadcastPlayerUpdate(player);
        }
      }
    }
  }

  private sampleGarbageProblem(): ProblemFull {
    const allProblems = this.loadProblems();
    const garbageProblems = allProblems.filter((p) => p.isGarbage);

    if (garbageProblems.length > 0) {
      const selected = garbageProblems[Math.floor(Math.random() * garbageProblems.length)];
      if (selected) return selected;
    }

    // Fallback: pick any easy problem and mark as garbage
    const easyProblems = allProblems.filter((p) => p.difficulty === "easy");
    let problem: ProblemFull | undefined;
    if (easyProblems.length > 0) {
      problem = easyProblems[Math.floor(Math.random() * easyProblems.length)];
    }
    if (!problem && allProblems.length > 0) {
      problem = allProblems[Math.floor(Math.random() * allProblems.length)];
    }

    if (!problem) {
      throw new Error("No problems available for garbage");
    }

    return { ...problem, isGarbage: true };
  }

  // ============================================================================
  // Match End Logic
  // ============================================================================

  private async checkMatchEnd() {
    if (this.state.match.phase === "lobby" || this.state.match.phase === "ended") {
      return;
    }

    // Get alive players (non-spectators who aren't eliminated)
    const alivePlayers = Array.from(this.state.players.values()).filter(
      (p) => p.role !== "spectator" && p.status !== "eliminated",
    );

    let endReason: MatchEndReason | null = null;

    // Check if only one player remains
    if (alivePlayers.length <= 1) {
      endReason = "lastAlive";
    }

    // Check if time expired (with 100ms tolerance for server timing)
    const now = Date.now();
    if (this.state.match.endAt && new Date(this.state.match.endAt).getTime() <= now + 100) {
      endReason = "timeExpired";
    }

    if (!endReason) {
      return;
    }

    console.log(`[${this.state.roomId}] Ending match, reason: ${endReason}`);
    await this.endMatch(endReason);
  }

  private async endMatch(endReason: MatchEndReason) {
    // Determine winner and standings
    const participants = Array.from(this.state.players.values()).filter(
      (p) => p.role !== "spectator",
    );

    // Sort by: alive first, then score desc, then stackSize asc, then playerId
    const sorted = [...participants].sort((a, b) => {
      // Alive players first
      const aAlive = a.status !== "eliminated" ? 1 : 0;
      const bAlive = b.status !== "eliminated" ? 1 : 0;
      if (aAlive !== bAlive) return bAlive - aAlive;

      // Higher score first
      if (a.score !== b.score) return b.score - a.score;

      // Lower stack size first
      if (a.stackSize !== b.stackSize) return a.stackSize - b.stackSize;

      // Stable by playerId
      return a.playerId.localeCompare(b.playerId);
    });

    let winner: PlayerInternal | undefined;
    if (endReason === "lastAlive") {
      winner = sorted.find((p) => p.status !== "eliminated");
    } else {
      winner = sorted[0];
    }

    const standings: StandingEntry[] = sorted.map((p, i) => ({
      rank: i + 1,
      playerId: p.playerId,
      username: p.username,
      role: p.role,
      score: p.score,
      status: p.status === "eliminated" ? "Eliminated" : "Survived",
    }));

    // Set actual end time
    const actualEndAt = new Date().toISOString();

    // Update match state
    this.state.match.phase = "ended";
    this.state.match.endReason = endReason;
    this.state.match.endAt = actualEndAt;
    this.state.match.standings = standings;

    // Clear scheduled arrivals
    this.state.nextProblemArrivalAt = null;
    this.state.nextBotActionAt = null;

    // Broadcast MATCH_END
    this.broadcast({
      type: "MATCH_END",
      payload: {
        matchId: this.state.match.matchId!,
        endReason,
        winnerPlayerId: winner?.playerId ?? sorted[0]?.playerId ?? "",
        standings,
      },
    });

    // Also broadcast phase update
    this.broadcast({
      type: "MATCH_PHASE_UPDATE",
      payload: {
        matchId: this.state.match.matchId!,
        phase: "ended",
      },
    });

    // Persist to PartyKit storage
    await this.persistState();

    // Persist to Supabase (Section 9.2)
    const matchPlayers: MatchPlayerEntry[] = sorted
      .filter((p) => p.role === "player" || p.role === "bot")
      .map((p, i) => ({
        playerId: p.playerId,
        username: p.username,
        role: p.role as "player" | "bot",
        score: p.score,
        rank: i + 1,
        eliminatedAt: p.eliminatedAt ?? null,
      }));

    const saveResult = await saveMatch(
      this.state.match.matchId!,
      this.state.roomId,
      this.state.match.startAt!,
      actualEndAt,
      endReason,
      this.state.match.settings,
      matchPlayers,
    );

    if (!saveResult.ok) {
      console.error(
        `[${this.state.roomId}] Failed to persist match to Supabase:`,
        saveResult.error,
      );
      // Continue anyway - match end is already broadcast
    } else {
      console.log(
        `[${this.state.roomId}] Match persisted to Supabase: ${this.state.match.matchId}`,
      );
    }

    this.addEventLog(
      "info",
      `Match ended: ${winner?.username ?? "Unknown"} wins! (${endReason})`,
    );
    console.log(
      `[${this.state.roomId}] Match ended: ${endReason}, winner: ${winner?.username}`,
    );
  }

  // ============================================================================
  // Bot Simulation
  // ============================================================================

  private calculateNextBotActionTime(bot: PlayerInternal): number {
    if (!bot.currentProblem) return Date.now() + 60000;

    // Solve time based on difficulty
    const difficulty = bot.currentProblem.difficulty;
    let minTime: number, maxTime: number;
    switch (difficulty) {
      case "easy":
        minTime = 30000;
        maxTime = 60000;
        break;
      case "medium":
        minTime = 45000;
        maxTime = 90000;
        break;
      case "hard":
        minTime = 60000;
        maxTime = 120000;
        break;
      default:
        minTime = 45000;
        maxTime = 90000;
    }

    const solveTime = minTime + Math.random() * (maxTime - minTime);
    return Date.now() + solveTime;
  }

  private async scheduleBotActions() {
    if (this.state.match.phase === "lobby" || this.state.match.phase === "ended") {
      this.state.nextBotActionAt = null;
      return;
    }

    const bots = Array.from(this.state.players.values()).filter(
      (p) => p.role === "bot" && p.status !== "eliminated",
    );

    if (bots.length === 0) {
      this.state.nextBotActionAt = null;
      return;
    }

    // Find the earliest bot action time
    let earliestActionAt = Infinity;
    for (const bot of bots) {
      if (!bot.nextBotActionAt) {
        bot.nextBotActionAt = this.calculateNextBotActionTime(bot);
      }
      earliestActionAt = Math.min(earliestActionAt, bot.nextBotActionAt);
    }

    if (earliestActionAt === Infinity) {
      this.state.nextBotActionAt = null;
      return;
    }

    this.state.nextBotActionAt = earliestActionAt;
    await this.scheduleNextAlarm();
  }

  private async handleBotActions() {
    if (this.state.match.phase === "lobby" || this.state.match.phase === "ended") {
      return;
    }

    const now = Date.now();
    const bots = Array.from(this.state.players.values()).filter(
      (p) => p.role === "bot" && p.status !== "eliminated",
    );

    for (const bot of bots) {
      if (bot.nextBotActionAt && now >= bot.nextBotActionAt) {
        await this.simulateBotSubmission(bot);
      }
    }

    await this.scheduleBotActions();
    await this.persistState();
  }

  private async simulateBotSubmission(bot: PlayerInternal) {
    if (!bot.currentProblem) return;

    const problem = this.getFullProblem(bot.currentProblem.problemId);
    if (!problem) return;

    // 20% failure rate
    const passed = Math.random() > 0.2;

    const result: JudgeResult = {
      kind: "submit",
      problemId: problem.problemId,
      passed,
      publicTests:
        problem.problemType === "code"
          ? problem.publicTests.map((_, index) => ({
              index,
              passed,
            }))
          : [],
      hiddenTestsPassed: passed,
    };

    // Process result (similar to player submission but without connection)
    if (!result.passed) {
      bot.streak = 0;
      bot.status = "error";
      this.broadcastPlayerUpdate(bot);
    } else {
      const isGarbage = problem.isGarbage ?? false;

      if (!isGarbage) {
        const points = DIFFICULTY_SCORES[problem.difficulty] || 0;
        bot.score += points;
        bot.streak += 1;

        // Send attack
        const attackType = this.determineAttackType(problem.difficulty, bot.streak);
        await this.sendAttack(bot, attackType);

        this.addEventLog(
          "info",
          `${bot.username} solved ${problem.title} (+${points}) and sent ${attackType}`,
        );
      } else {
        this.addEventLog("info", `${bot.username} cleared garbage: ${problem.title}`);
      }

      this.advanceToNextProblem(bot);
      bot.status = "coding";
      this.broadcastPlayerUpdate(bot);
      this.broadcastStackUpdate(bot);

      // Check for match end
      await this.checkMatchEnd();
    }

    // Schedule next action
    bot.nextBotActionAt = this.calculateNextBotActionTime(bot);
  }

  // ============================================================================
  // State Builders
  // ============================================================================

  private buildRoomSnapshot(forPlayer: PlayerInternal): RoomSnapshotPayload {
    const players: PlayerPublic[] = [];
    for (const p of this.state.players.values()) {
      players.push({
        playerId: p.playerId,
        username: p.username,
        role: p.role,
        status: p.status,
        isHost: p.isHost,
        score: p.score,
        streak: p.streak,
        targetingMode: p.targetingMode,
        stackSize: p.stackSize,
        activeDebuff: p.activeDebuff as PlayerPublic["activeDebuff"],
        activeBuff: p.activeBuff as PlayerPublic["activeBuff"],
      });
    }

    // Build private state for the requesting player
    let self: PlayerPrivateState | undefined;
    if (forPlayer.role === "player" && this.state.match.phase !== "lobby") {
      // During match, include private state
      self = {
        currentProblem: forPlayer.currentProblem ?? null,
        queued: forPlayer.queued ?? [],
        code: forPlayer.code ?? "",
        codeVersion: forPlayer.codeVersion ?? 1,
        revealedHints: forPlayer.revealedHints ?? [],
      };
    }

    // Build spectate view if spectating
    let spectating: SpectateView | null = null;
    if (forPlayer.spectatingPlayerId) {
      const target = this.state.players.get(forPlayer.spectatingPlayerId);
      if (target) {
        spectating = this.buildSpectateView(target);
      }
    }

    return {
      roomId: this.state.roomId,
      serverTime: new Date().toISOString(),
      me: {
        playerId: forPlayer.playerId,
        username: forPlayer.username,
        role: forPlayer.role,
        isHost: forPlayer.isHost,
        status: forPlayer.status,
      },
      players,
      match: this.state.match,
      shopCatalog: DEFAULT_SHOP_CATALOG,
      self,
      spectating,
      chat: this.state.chat,
      eventLog: this.state.eventLog,
    };
  }

  private buildSpectateView(target: PlayerInternal): SpectateView {
    return {
      playerId: target.playerId,
      username: target.username,
      status: target.status,
      score: target.score,
      streak: target.streak,
      targetingMode: target.targetingMode,
      stackSize: target.stackSize,
      activeDebuff: target.activeDebuff as SpectateView["activeDebuff"],
      activeBuff: target.activeBuff as SpectateView["activeBuff"],
      currentProblem: target.currentProblem ?? null,
      queued: target.queued ?? [],
      code: target.code ?? "",
      codeVersion: target.codeVersion ?? 1,
      revealedHints: target.revealedHints ?? [],
    };
  }

  // ============================================================================
  // Game State Management
  // ============================================================================

  /**
   * Add a problem to the top of a player's queue
   * Returns true if player was eliminated due to overflow
   */
  private addProblemToQueue(
    player: PlayerInternal,
    problem: ProblemFull,
  ): boolean {
    if (player.role !== "player" && player.role !== "bot") {
      return false;
    }

    if (player.status === "eliminated") {
      return false;
    }

    // Ensure queued array exists
    if (!player.queued) {
      player.queued = [];
    }

    // Check for overflow (stackSize counts queued only, current excluded)
    if (player.stackSize >= this.state.match.settings.stackLimit) {
      // Eliminate player
      player.status = "eliminated";
      player.eliminatedAt = new Date().toISOString();
      player.stackSize = player.stackSize + 1; // Show overflow
      this.addEventLog(
        "warning",
        `${player.username} was eliminated (stack overflow)`,
      );
      this.broadcastPlayerUpdate(player);
      return true;
    }

    // Push to top of queue (index 0)
    const summary: ProblemSummary = {
      problemId: problem.problemId,
      title: problem.title,
      difficulty: problem.difficulty,
      isGarbage: problem.isGarbage,
    };
    player.queued.unshift(summary);
    player.stackSize = player.queued.length;
    return false;
  }

  /**
   * Advance player to next problem (pop from queue or sample new)
   */
  private advanceToNextProblem(player: PlayerInternal): void {
    if (
      (player.role !== "player" && player.role !== "bot") ||
      player.status === "eliminated"
    ) {
      return;
    }

    // Ensure queued array exists
    if (!player.queued) {
      player.queued = [];
    }

    // Pop from queue if available
    let nextProblem: ProblemFull | null = null;
    if (player.queued.length > 0) {
      const nextSummary = player.queued.shift();
      player.stackSize = player.queued.length;

      if (nextSummary) {
        // Find the full problem by ID
        const allProblems = this.loadProblems();
        nextProblem =
          allProblems.find((p) => p.problemId === nextSummary.problemId) ??
          null;
      }
    }

    // If queue empty, sample a new problem
    if (!nextProblem) {
      try {
        nextProblem = this.sampleProblem(player.playerId, true);
      } catch (error) {
        console.error(
          `[${this.state.roomId}] Failed to sample problem for ${player.playerId}:`,
          error,
        );
        return;
      }
    }

    if (nextProblem) {
      player.currentProblem = this.toClientView(nextProblem);
      player.code = nextProblem.problemType === "code" ? nextProblem.starterCode : "";
      player.codeVersion = 1;
      player.revealedHints = [];
    }
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private findPlayerByConnection(
    connectionId: string,
  ): PlayerInternal | undefined {
    for (const player of this.state.players.values()) {
      if (player.connectionId === connectionId) {
        return player;
      }
    }
    return undefined;
  }

  private getPlayerConnection(player: PlayerInternal): Party.Connection | undefined {
    if (!player.connectionId) return undefined;
    for (const conn of this.room.getConnections()) {
      if (conn.id === player.connectionId) {
        return conn;
      }
    }
    return undefined;
  }

  private transferHost() {
    // Find first connected human player by join order
    let newHost: PlayerInternal | undefined;
    for (const player of this.state.players.values()) {
      if (
        player.role === "player" &&
        player.connectionId &&
        (!newHost || player.joinOrder < newHost.joinOrder)
      ) {
        newHost = player;
      }
    }

    // Update host
    if (newHost) {
      for (const player of this.state.players.values()) {
        player.isHost = player === newHost;
      }
      console.log(
        `[${this.state.roomId}] Host transferred to: ${newHost.username}`,
      );
      this.addSystemChat(`${newHost.username} is now the host`);
    } else {
      // No connected human players remain; keep existing host assignment.
      console.log(
        `[${this.state.roomId}] No connected players, host unchanged`,
      );
    }
  }

  private addSystemChat(text: string) {
    const msg: ChatMessage = {
      id: `c_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      at: new Date().toISOString(),
      kind: "system",
      text,
    };
    this.state.chat.push(msg);

    // Keep only last 100 messages
    if (this.state.chat.length > 100) {
      this.state.chat = this.state.chat.slice(-100);
    }

    this.broadcast({
      type: "CHAT_APPEND",
      payload: { message: msg },
    });
  }

  private broadcast(message: unknown) {
    const json = JSON.stringify(message);
    for (const conn of this.room.getConnections()) {
      conn.send(json);
    }
  }

  private broadcastPlayerUpdate(player: PlayerInternal) {
    this.broadcast({
      type: "PLAYER_UPDATE",
      payload: {
        player: {
          playerId: player.playerId,
          username: player.username,
          role: player.role,
          status: player.status,
          isHost: player.isHost,
          score: player.score,
          streak: player.streak,
          targetingMode: player.targetingMode,
          stackSize: player.stackSize,
          activeDebuff: player.activeDebuff,
          activeBuff: player.activeBuff,
        },
      },
    });
  }

  private broadcastStackUpdate(player: PlayerInternal) {
    this.broadcast({
      type: "STACK_UPDATE",
      payload: {
        playerId: player.playerId,
        stackSize: player.stackSize,
      },
    });
  }

  private sendError(
    conn: Party.Connection,
    code: string,
    message: string,
    requestId?: string,
    retryAfterMs?: number,
  ) {
    const payload: ErrorPayload = { code, message, retryAfterMs };
    const msg: WSMessage<"ERROR", ErrorPayload> = {
      type: "ERROR",
      requestId,
      payload,
    };
    conn.send(JSON.stringify(msg));
  }

  private sendJudgeResult(
    conn: Party.Connection,
    player: PlayerInternal,
    result: JudgeResult,
    requestId?: string,
  ) {
    const msg: WSMessage<"JUDGE_RESULT", JudgeResult> = {
      type: "JUDGE_RESULT",
      requestId,
      payload: result,
    };
    conn.send(JSON.stringify(msg));

    // Also send to spectators
    this.sendJudgeResultToSpectators(player, result);
  }

  private sendJudgeResultToSpectators(player: PlayerInternal, result: JudgeResult) {
    for (const spectator of this.state.players.values()) {
      if (spectator.spectatingPlayerId === player.playerId) {
        const conn = this.getPlayerConnection(spectator);
        if (conn) {
          const msg: WSMessage<"JUDGE_RESULT", JudgeResult> = {
            type: "JUDGE_RESULT",
            payload: result,
          };
          conn.send(JSON.stringify(msg));
        }
      }
    }
  }

  private relayCodeUpdateToSpectators(player: PlayerInternal, payload: CodeUpdateClientPayload) {
    for (const spectator of this.state.players.values()) {
      if (spectator.spectatingPlayerId === player.playerId) {
        const conn = this.getPlayerConnection(spectator);
        if (conn) {
          const msg: WSMessage<"CODE_UPDATE", {
            playerId: string;
            problemId: string;
            code: string;
            codeVersion: number;
          }> = {
            type: "CODE_UPDATE",
            payload: {
              playerId: player.playerId,
              problemId: payload.problemId,
              code: payload.code,
              codeVersion: payload.codeVersion,
            },
          };
          conn.send(JSON.stringify(msg));
        }
      }
    }
  }

  private updateSpectators(player: PlayerInternal) {
    for (const spectator of this.state.players.values()) {
      if (spectator.spectatingPlayerId === player.playerId) {
        const conn = this.getPlayerConnection(spectator);
        if (conn) {
          const spectateView = this.buildSpectateView(player);
          const msg: WSMessage<"SPECTATE_STATE", { spectating: SpectateView | null }> = {
            type: "SPECTATE_STATE",
            payload: { spectating: spectateView },
          };
          conn.send(JSON.stringify(msg));
        }
      }
    }
  }

  private addEventLog(level: "info" | "warning" | "error", message: string) {
    const entry: EventLogEntry = {
      id: `e_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      at: new Date().toISOString(),
      level,
      message,
    };
    this.state.eventLog.push(entry);

    this.broadcast({
      type: "EVENT_LOG_APPEND",
      payload: { entry },
    });
  }

  private async persistState() {
    // Serialize Maps for storage
    const serializedPlayers: Record<string, unknown> = {};
    for (const [id, player] of this.state.players) {
      serializedPlayers[id] = {
        ...player,
        rateLimits: player.rateLimits
          ? Object.fromEntries(player.rateLimits)
          : undefined,
        recentAttackers: player.recentAttackers
          ? Object.fromEntries(player.recentAttackers)
          : undefined,
        shopCooldowns: player.shopCooldowns
          ? Object.fromEntries(player.shopCooldowns)
          : undefined,
      };
    }

    await this.room.storage.put("state", {
      ...this.state,
      players: serializedPlayers,
      playerProblemHistory: Object.fromEntries(
        Array.from(this.state.playerProblemHistory.entries()).map(([k, v]) => [
          k,
          Array.from(v),
        ]),
      ),
    });
  }

  // ============================================================================
  // Judge Simulation (for development without Judge0)
  // ============================================================================

  private simulateJudgeResult(
    kind: "run" | "submit",
    problem: ProblemFull,
    code: string,
  ): JudgeResult {
    let passed = false;

    if (problem.problemType === "mcq") {
      // For MCQ, 'code' is the selected option ID
      passed = code === problem.correctAnswer;
    } else {
      // Simple simulation: pass if code contains the function name
      passed = code.includes(problem.functionName) && code.length > 50;
    }

    const publicTests =
      problem.problemType === "code"
        ? (problem.publicTests || []).map((_, index) => ({
            index,
            passed,
            expected: passed ? undefined : "expected",
            received: passed ? undefined : "received",
          }))
        : [];

    return {
      kind,
      problemId: problem.problemId,
      passed,
      publicTests,
      runtimeMs: Math.floor(Math.random() * 100) + 10,
      hiddenTestsPassed: kind === "submit" ? passed : undefined,
      hiddenFailureMessage: kind === "submit" && !passed ? "Failed hidden tests" : undefined,
    };
  }

  private getFullProblem(problemId: string): ProblemFull | undefined {
    const allProblems = this.loadProblems();
    return allProblems.find((p) => p.problemId === problemId);
  }

  // ============================================================================
  // Timed Problem Arrivals
  // ============================================================================

  /**
   * Calculate the problem arrival interval for a player based on phase and buffs/debuffs
   */
  private calculateProblemArrivalInterval(player: PlayerInternal): number {
    // Base interval based on phase
    const baseIntervalSec = this.state.match.phase === "warmup" ? 90 : 60;

    // Apply multipliers
    let memoryLeakMultiplier = 1;
    if (
      player.activeDebuff?.type === "memoryLeak" &&
      new Date(player.activeDebuff.endsAt) > new Date()
    ) {
      memoryLeakMultiplier = 0.5;
    }

    let rateLimiterMultiplier = 1;
    if (
      player.activeBuff?.type === "rateLimiter" &&
      new Date(player.activeBuff.endsAt) > new Date()
    ) {
      rateLimiterMultiplier = 2;
    }

    const effectiveIntervalSec =
      baseIntervalSec * memoryLeakMultiplier * rateLimiterMultiplier;

    return effectiveIntervalSec * 1000; // Convert to milliseconds
  }

  /**
   * Handle timed problem arrivals for all alive players
   * Checks each player individually based on their effective interval
   */
  private async handleProblemArrivals(): Promise<void> {
    if (
      this.state.match.phase === "lobby" ||
      this.state.match.phase === "ended"
    ) {
      this.state.nextProblemArrivalAt = null;
      return;
    }

    // Check if match has ended due to time expiration
    if (
      this.state.match.endAt &&
      new Date(this.state.match.endAt) <= new Date()
    ) {
      await this.checkMatchEnd();
      return;
    }

    const now = Date.now();
    const alivePlayers = Array.from(this.state.players.values()).filter(
      (p) =>
        (p.role === "player" || p.role === "bot") && p.status !== "eliminated",
    );

    if (alivePlayers.length === 0) {
      // No alive players, cancel future arrivals
      this.state.nextProblemArrivalAt = null;
      await this.persistState();
      return;
    }

    // Check each player individually based on their effective interval
    for (const player of alivePlayers) {
      // Initialize lastProblemArrivalAt if not set (shouldn't happen, but safety check)
      if (!player.lastProblemArrivalAt) {
        player.lastProblemArrivalAt = now;
      }

      // Calculate this player's effective interval
      const effectiveIntervalMs = this.calculateProblemArrivalInterval(player);

      // Check if enough time has passed for this player
      const timeSinceLastArrival = now - player.lastProblemArrivalAt;
      if (timeSinceLastArrival >= effectiveIntervalMs) {
        if (DEBUG_TIMERS) {
          console.log(
            `[${this.state.roomId}] Problem due for ${player.username}: ` +
              `since=${timeSinceLastArrival}ms interval=${effectiveIntervalMs}ms`,
          );
        }
        try {
          const problem = this.sampleProblem(player.playerId, false); // Allow garbage
          const eliminated = this.addProblemToQueue(player, problem);

          // Update last arrival time
          player.lastProblemArrivalAt = now;

          if (eliminated) {
            // Player was eliminated due to overflow
            // Already handled in addProblemToQueue (event log + broadcast)
            console.log(
              `[${this.state.roomId}] Player ${player.username} eliminated by stack overflow`,
            );
          } else {
            if (DEBUG_TIMERS) {
              console.log(
                `[${this.state.roomId}] Added problem to ${player.username} queue: ` +
                  `${problem.problemId}`,
              );
            }
            // Broadcast stack update for this player
            this.broadcastPlayerUpdate(player);
            this.broadcastStackUpdate(player);
            this.updateSpectators(player);

            // Send updated private snapshot so the client queue reflects timed arrivals
            const conn = this.getPlayerConnection(player);
            if (conn) {
              const snapshot = this.buildRoomSnapshot(player);
              conn.send(JSON.stringify({ type: "ROOM_SNAPSHOT", payload: snapshot }));
            }
          }
        } catch (error) {
          console.error(
            `[${this.state.roomId}] Failed to sample problem for ${player.playerId}:`,
            error,
          );
        }
      }
    }

    // Schedule next problem arrival based on when the next player needs one
    await this.scheduleNextProblemArrival();

    // Check for match end
    await this.checkMatchEnd();

    await this.persistState();
  }

  /**
   * Schedule the next problem arrival alarm
   * Finds the minimum time until any player needs a problem based on their effective intervals
   */
  private async scheduleNextProblemArrival(): Promise<void> {
    if (
      this.state.match.phase === "lobby" ||
      this.state.match.phase === "ended"
    ) {
      this.state.nextProblemArrivalAt = null;
      return;
    }

    // Check if match has ended due to time expiration
    if (
      this.state.match.endAt &&
      new Date(this.state.match.endAt) <= new Date()
    ) {
      this.state.nextProblemArrivalAt = null;
      return;
    }

    const now = Date.now();
    const alivePlayers = Array.from(this.state.players.values()).filter(
      (p) =>
        (p.role === "player" || p.role === "bot") && p.status !== "eliminated",
    );

    if (alivePlayers.length === 0) {
      this.state.nextProblemArrivalAt = null;
      return;
    }

    // Find the minimum time until any player needs a problem
    let minTimeUntilNextArrival = Infinity;

    for (const player of alivePlayers) {
      // Initialize if not set
      if (!player.lastProblemArrivalAt) {
        player.lastProblemArrivalAt = now;
      }

      // Calculate this player's effective interval
      const effectiveIntervalMs = this.calculateProblemArrivalInterval(player);

      // Calculate time since last arrival
      const timeSinceLastArrival = now - player.lastProblemArrivalAt;

      // Calculate time until next arrival for this player
      const timeUntilNextArrival = Math.max(
        0,
        effectiveIntervalMs - timeSinceLastArrival,
      );

      minTimeUntilNextArrival = Math.min(
        minTimeUntilNextArrival,
        timeUntilNextArrival,
      );
    }

    // If all players are already due (shouldn't happen, but handle gracefully)
    if (minTimeUntilNextArrival === Infinity || minTimeUntilNextArrival < 0) {
      // Schedule a very short delay to check again soon
      minTimeUntilNextArrival = 1000; // 1 second
    }

    let nextArrivalAt = now + minTimeUntilNextArrival;

    // Don't schedule arrivals beyond match end time
    if (
      this.state.match.endAt &&
      nextArrivalAt > new Date(this.state.match.endAt).getTime()
    ) {
      this.state.nextProblemArrivalAt = null;
      nextArrivalAt = Infinity; // Still continue to schedule other alarms
    } else {
      this.state.nextProblemArrivalAt = nextArrivalAt;
    }

    await this.scheduleNextAlarm();
  }

  /**
   * Schedule the next alarm based on the earliest pending event.
   */
  private async scheduleNextAlarm(): Promise<void> {
    if (this.state.match.phase === "lobby" || this.state.match.phase === "ended") {
      return;
    }

    const warmupEndAt =
      this.state.match.startAt && this.state.match.phase === "warmup"
        ? new Date(this.state.match.startAt).getTime() +
        this.state.settings.matchDurationSec * 1000 * 0.1
        : Infinity;

    const matchEndAt = this.state.match.endAt
      ? new Date(this.state.match.endAt).getTime()
      : Infinity;

    const nextArrivalAt = this.state.nextProblemArrivalAt ?? Infinity;
    const botActionAt = this.state.nextBotActionAt ?? Infinity;

    let effectExpiryAt = Infinity;
    for (const player of this.state.players.values()) {
      if (player.activeDebuff) {
        effectExpiryAt = Math.min(
          effectExpiryAt,
          new Date(player.activeDebuff.endsAt).getTime(),
        );
      }
      if (player.activeBuff) {
        effectExpiryAt = Math.min(
          effectExpiryAt,
          new Date(player.activeBuff.endsAt).getTime(),
        );
      }
    }

    const alarmAt = Math.min(
      nextArrivalAt,
      warmupEndAt,
      matchEndAt,
      botActionAt,
      effectExpiryAt,
    );
    if (!Number.isFinite(alarmAt)) {
      return;
    }

    const now = Date.now();
    const scheduledAt = alarmAt <= now ? now + 100 : alarmAt;
    if (DEBUG_TIMERS) {
      console.log(
        `[${this.state.roomId}] scheduleNextAlarm ` +
          `arrival=${nextArrivalAt === Infinity ? "∞" : new Date(nextArrivalAt).toISOString()} ` +
          `warmupEnd=${warmupEndAt === Infinity ? "∞" : new Date(warmupEndAt).toISOString()} ` +
          `matchEnd=${matchEndAt === Infinity ? "∞" : new Date(matchEndAt).toISOString()} ` +
          `bot=${botActionAt === Infinity ? "∞" : new Date(botActionAt).toISOString()} ` +
          `effect=${effectExpiryAt === Infinity ? "∞" : new Date(effectExpiryAt).toISOString()}`,
      );
    }
    await this.room.storage.setAlarm(scheduledAt);
    console.log(
      `[${this.state.roomId}] Scheduled next alarm at ${new Date(scheduledAt).toISOString()} (in ${Math.round(scheduledAt - now)}ms)`,
    );
  }

  // ============================================================================
  // Problem Management
  // ============================================================================

  private cachedProblems: ProblemFull[] | null = null;

  private loadProblems(): ProblemFull[] {
    if (!this.cachedProblems) {
      // Validate and cache problems
      this.cachedProblems = PROBLEMS_DATA.map((p) =>
        ProblemFullSchema.parse(p),
      );
    }
    return this.cachedProblems;
  }

  private sampleProblem(
    playerId: string,
    excludeGarbage: boolean = true,
  ): ProblemFull {
    const allProblems = this.loadProblems();
    let pool = excludeGarbage
      ? allProblems.filter((p) => !p.isGarbage)
      : allProblems;

    if (pool.length === 0) {
      throw new Error("No problems available in pool");
    }

    // Get player's history
    let history = this.state.playerProblemHistory.get(playerId);
    if (!history) {
      history = new Set();
      this.state.playerProblemHistory.set(playerId, history);
    }

    // Filter out seen problems
    const unseen = pool.filter((p) => !history.has(p.problemId));

    // If all seen, reset history and use full pool
    if (unseen.length === 0) {
      history.clear();
      pool = excludeGarbage
        ? allProblems.filter((p) => !p.isGarbage)
        : allProblems;
    } else {
      pool = unseen;
    }

    // Apply difficulty weights
    const weights = this.getDifficultyWeights();
    const weightedPool: { problem: ProblemFull; weight: number }[] = [];

    for (const problem of pool) {
      const weight = weights[problem.difficulty] || 1;
      weightedPool.push({ problem, weight });
    }

    // Weighted random selection
    const totalWeight = weightedPool.reduce(
      (sum, item) => sum + item.weight,
      0,
    );
    let random = Math.random() * totalWeight;

    for (const item of weightedPool) {
      random -= item.weight;
      if (random <= 0) {
        // Add to history
        history.add(item.problem.problemId);
        return item.problem;
      }
    }

    // Fallback (should never reach here, but handle it safely)
    const selected = weightedPool[0]?.problem ?? pool[0];
    if (selected) {
      history.add(selected.problemId);
      return selected;
    }

    // Ultimate fallback - this should never happen
    throw new Error("Failed to sample problem");
  }

  private getDifficultyWeights(): Record<"easy" | "medium" | "hard", number> {
    const profile = this.state.settings.difficultyProfile;
    const DIFFICULTY_WEIGHTS = {
      beginner: { easy: 70, medium: 25, hard: 5 },
      moderate: { easy: 40, medium: 40, hard: 20 },
      competitive: { easy: 20, medium: 40, hard: 40 },
    };
    return DIFFICULTY_WEIGHTS[profile];
  }

  private toClientView(problem: ProblemFull): ProblemClientView {
    // Strip hidden tests and server-only fields
    if (problem.problemType === "code") {
      const { hiddenTests: _hiddenTests, hints, solutionSketch: _solutionSketch, ...clientView } = problem;
      return {
        ...clientView,
        hintCount: hints?.length,
      };
    } else {
      const { hiddenTests: _hiddenTests, hints, correctAnswer: _correctAnswer, ...clientView } = problem;
      return {
        ...clientView,
        hintCount: hints?.length,
      };
    }
  }

  async onAlarm() {
    const now = Date.now();
    this.addEventLog("info", `Server: onAlarm (phase: ${this.state.match.phase})`);

    if (DEBUG_TIMERS) {
      console.log(
        `[${this.state.roomId}] onAlarm now=${new Date(now).toISOString()} ` +
          `phase=${this.state.match.phase} ` +
          `nextArrival=${this.state.nextProblemArrivalAt ? new Date(this.state.nextProblemArrivalAt).toISOString() : "null"} ` +
          `nextBot=${this.state.nextBotActionAt ? new Date(this.state.nextBotActionAt).toISOString() : "null"}`,
      );
    }

    let didWork = false;

    // Handle expired debuffs and buffs
    this.handleExpiredDebuffs();

    // Check if match has ended due to time expiration (with 100ms tolerance)
    if (
      this.state.match.endAt &&
      new Date(this.state.match.endAt).getTime() <= now + 100
    ) {
      console.log(`[${this.state.roomId}] Match end time reached, checking end...`);
      await this.checkMatchEnd();
      return;
    }

    // Check if it's time for bot actions
    if (
      this.state.nextBotActionAt !== null &&
      now >= this.state.nextBotActionAt
    ) {
      await this.handleBotActions();
      didWork = true;
    }

    // Check if it's time for problem arrivals
    if (
      this.state.nextProblemArrivalAt !== null &&
      now >= this.state.nextProblemArrivalAt - 100 // Tolerance
    ) {
      await this.handleProblemArrivals();
      didWork = true;
    }

    // Handle warmup -> main transition
    if (this.state.match.phase === "warmup") {
      this.state.match.phase = "main";
      await this.persistState();

      this.broadcast({
        type: "MATCH_PHASE_UPDATE",
        payload: {
          matchId: this.state.match.matchId!,
          phase: "main",
        },
      });

      this.addEventLog("info", "Main phase started");
      console.log(`[${this.state.roomId}] Transitioned to main phase`);

      // Reschedule problem arrivals with new phase interval
      await this.scheduleNextProblemArrival();
      didWork = true;
    }

    if (!didWork) {
      await this.scheduleNextAlarm();
    }
  }

  // ============================================================================
  // HTTP Handlers (for room state synchronization)
  // ============================================================================

  async onRequest(req: Party.Request): Promise<Response> {

    const url = new URL(req.url);

    // POST /parties/leet99/:roomId/register - Register a new player
    if (req.method === "POST" && url.pathname.endsWith("/register")) {
      const json = (data: unknown, status = 200) =>
        new Response(JSON.stringify(data), {
          status,
          headers: { "Content-Type": "application/json" },
        });

      const httpError = (
        code: string,
        message: string,
        status: number,
        details?: unknown,
      ) => {
        const body: HttpErrorResponse = {
          error: {
            code,
            message,
            ...(details === undefined ? {} : { details }),
          },
        };
        return json(body, status);
      };

      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return httpError("BAD_REQUEST", "Invalid JSON body", 400);
      }

      const parsed = PartyRegisterRequestSchema.safeParse(body);
      if (!parsed.success) {
        return httpError(
          "BAD_REQUEST",
          "Invalid request body",
          400,
          parsed.error.flatten(),
        );
      }

      const result = applyPartyRegister(this.state, parsed.data);
      if (!result.ok) {
        const status =
          result.error.code === "ROOM_NOT_FOUND"
            ? 404
            : result.error.code === "BAD_REQUEST"
              ? 400
              : 409;
        return httpError(result.error.code, result.error.message, status);
      }

      const response = PartyRegisterResponseSchema.parse(result.response);

      // Persist state
      await this.room.storage.put("state", {
        ...this.state,
        players: Object.fromEntries(this.state.players),
      });

      return json(response, 200);
    }

    // GET /parties/leet99/:roomId/state - Get room state (for debugging)
    if (req.method === "GET" && url.pathname.endsWith("/state")) {
      // Count players by role and status
      let activePlayers = 0;
      let spectators = 0;
      let bots = 0;

      for (const player of this.state.players.values()) {
        if (player.role === "bot") {
          bots++;
        } else if (player.role === "spectator") {
          spectators++;
        } else if (player.role === "player") {
          // Players who were eliminated become spectators in the count
          if (player.status === "eliminated") {
            spectators++;
          } else {
            activePlayers++;
          }
        }
      }

      return new Response(
        JSON.stringify({
          roomId: this.state.roomId,
          phase: this.state.match.phase,
          playerCount: this.state.players.size, // Total for backwards compatibility
          playerCounts: {
            players: activePlayers,
            spectators: spectators,
            bots: bots,
          },
          settings: this.state.settings,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    return new Response("Not found", { status: 404 });
  }
}
