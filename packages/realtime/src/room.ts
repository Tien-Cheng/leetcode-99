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
  RoomSettings,
  RoomSnapshotPayload,
  WSMessage,
} from "@leet99/contracts";
import {
  DEFAULT_SHOP_CATALOG,
  PartyRegisterRequestSchema,
  PartyRegisterResponseSchema,
  RoomSettingsSchema,
} from "@leet99/contracts";

import { applyPartyRegister } from "./register.ts";

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
      };
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

        // TODO: Implement other message handlers
        // case 'SET_TARGET_MODE':
        // case 'UPDATE_SETTINGS':
        // case 'START_MATCH':
        // case 'ADD_BOTS':
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
        currentProblem: null, // TODO: populate from game state
        queued: [],
        code: "",
        codeVersion: 1,
        revealedHints: [],
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
