import type * as Party from "partykit/server";
import type {
  ChatMessage,
  ClientMessageType,
  ErrorPayload,
  EventLogEntry,
  HttpErrorResponse,
  JoinRoomPayload,
  MatchPublic,
  PlayerPrivateState,
  PlayerPublic,
  ProblemClientView,
  ProblemFull,
  ProblemSummary,
  RoomSettings,
  RoomSnapshotPayload,
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

// ============================================================================
// Room State Types
// ============================================================================

interface PlayerInternal {
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
  // Private state (only during match)
  currentProblem?: ProblemClientView | null;
  queued?: ProblemSummary[];
  code?: string;
  codeVersion?: number;
  revealedHints?: string[];
  lastProblemArrivalAt?: number; // Timestamp of last problem arrival (for per-player timing)
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
      };

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

        // Reschedule phase transition if in warmup
        if (this.state.match.phase === "warmup" && this.state.match.startAt) {
          const warmupEndAt =
            new Date(this.state.match.startAt).getTime() +
            this.state.settings.matchDurationSec * 1000 * 0.1;
          if (warmupEndAt > now) {
            await this.room.storage.setAlarm(warmupEndAt);
          }
        }

        // Reschedule match end check
        if (this.state.match.endAt) {
          const matchEndAt = new Date(this.state.match.endAt).getTime();
          if (matchEndAt > now) {
            await this.room.storage.setAlarm(matchEndAt);
          }
        }
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

        // TODO: Implement other message handlers
        // case 'SET_TARGET_MODE':
        // case 'RUN_CODE':
        // case 'SUBMIT_CODE':
        // case 'SPEND_POINTS':
        // case 'SPECTATE_PLAYER':
        // case 'CODE_UPDATE':

        default:
          this.sendError(
            sender,
            "BAD_REQUEST",
            `Unknown message type: ${parsed.type}`,
            parsed.requestId,
          );
      }
    } catch (err) {
      console.error(`[${this.state.roomId}] Error parsing message:`, err);
      this.sendError(sender, "BAD_REQUEST", "Invalid JSON message");
    }
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
    if (!text || text.length > 200) {
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

    // Update match state
    this.state.match = {
      matchId,
      phase: "warmup",
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
      p.code = current.starterCode;
      p.codeVersion = 1;
      p.revealedHints = [];
      p.stackSize = queued.length;
      p.lastProblemArrivalAt = now.getTime(); // Initialize to match start time
    }

    // Persist
    await this.persistState();

    // Schedule warmup -> main transition
    const warmupDurationMs = this.state.settings.matchDurationSec * 1000 * 0.1;
    await this.room.storage.setAlarm(Date.now() + warmupDurationMs);

    // Schedule first problem arrival
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
      spectating: null,
      chat: this.state.chat,
      eventLog: this.state.eventLog,
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
      player.code = nextProblem.starterCode;
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
    for (const player of this.state.players.values()) {
      player.isHost = player === newHost;
    }

    if (newHost) {
      console.log(
        `[${this.state.roomId}] Host transferred to: ${newHost.username}`,
      );
      this.addSystemChat(`${newHost.username} is now the host`);
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

  private sendError(
    conn: Party.Connection,
    code: string,
    message: string,
    requestId?: string,
  ) {
    const payload: ErrorPayload = { code, message };
    const msg: WSMessage<"ERROR", ErrorPayload> = {
      type: "ERROR",
      requestId,
      payload,
    };
    conn.send(JSON.stringify(msg));
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
    await this.room.storage.put("state", {
      ...this.state,
      players: Object.fromEntries(this.state.players),
      playerProblemHistory: Object.fromEntries(
        Array.from(this.state.playerProblemHistory.entries()).map(([k, v]) => [
          k,
          Array.from(v),
        ]),
      ),
    });
  }

  // ============================================================================
  // Timed Problem Arrivals
  // ============================================================================

  /**
   * Calculate the problem arrival interval for a player based on phase and buffs/debuffs
   */
  private calculateProblemArrivalInterval(player: PlayerInternal): number {
    // Base interval based on phase
    const baseIntervalSec =
      this.state.match.phase === "warmup" ? 90 : 60;

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
      // Match ended, stop problem arrivals
      // TODO: Handle match end logic (set phase to "ended", determine winner, etc.)
      this.state.nextProblemArrivalAt = null;
      await this.persistState();
      return;
    }

    const now = Date.now();
    const alivePlayers = Array.from(this.state.players.values()).filter(
      (p) =>
        (p.role === "player" || p.role === "bot") &&
        p.status !== "eliminated",
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
            // Broadcast stack update for this player
            this.broadcastPlayerUpdate(player);
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
        (p.role === "player" || p.role === "bot") &&
        p.status !== "eliminated",
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

    const nextArrivalAt = now + minTimeUntilNextArrival;

    // Don't schedule beyond match end time
    if (
      this.state.match.endAt &&
      nextArrivalAt > new Date(this.state.match.endAt).getTime()
    ) {
      this.state.nextProblemArrivalAt = null;
      return;
    }

    this.state.nextProblemArrivalAt = nextArrivalAt;

    // Schedule alarm (use the earlier of phase transition, problem arrival, or match end)
    const warmupEndAt =
      this.state.match.startAt &&
      this.state.match.phase === "warmup"
        ? new Date(this.state.match.startAt).getTime() +
          this.state.settings.matchDurationSec * 1000 * 0.1
        : Infinity;

    const matchEndAt = this.state.match.endAt
      ? new Date(this.state.match.endAt).getTime()
      : Infinity;

    const alarmAt = Math.min(nextArrivalAt, warmupEndAt, matchEndAt);
    await this.room.storage.setAlarm(alarmAt);

    console.log(
      `[${this.state.roomId}] Scheduled next problem arrival at ${new Date(nextArrivalAt).toISOString()} (${Math.round(minTimeUntilNextArrival / 1000)}s from now)`,
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
    const { hiddenTests, hints, solutionSketch, ...clientView } = problem;
    return {
      ...clientView,
      hintCount: hints?.length,
    };
  }

  async onAlarm() {
    const now = Date.now();

    // Check if match has ended due to time expiration
    if (
      this.state.match.endAt &&
      new Date(this.state.match.endAt) <= new Date()
    ) {
      // TODO: Handle match end logic (set phase to "ended", determine winner, broadcast MATCH_END, etc.)
      this.state.nextProblemArrivalAt = null;
      await this.persistState();
      return;
    }

    // Check if it's time for problem arrivals
    if (
      this.state.nextProblemArrivalAt !== null &&
      now >= this.state.nextProblemArrivalAt
    ) {
      await this.handleProblemArrivals();
      return;
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
      return new Response(
        JSON.stringify({
          roomId: this.state.roomId,
          phase: this.state.match.phase,
          playerCount: this.state.players.size,
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
