import { z } from "zod";
import {
  RoomSettingsSchema,
  PlayerPublicSchema,
  MatchPublicSchema,
  ChatMessageSchema,
  EventLogEntrySchema,
  ShopCatalogItemSchema,
  TargetingModeSchema,
  ShopItemSchema,
  AttackTypeSchema,
  StandingEntrySchema,
  PlayerRoleSchema,
  PlayerStatusSchema,
} from "./room.js";
import {
  ProblemSummarySchema,
  PlayerPrivateStateSchema,
  SpectateViewSchema,
  JudgeResultSchema,
} from "./problem.js";

// ============================================================================
// WebSocket Message Envelope
// ============================================================================

/**
 * Generic WebSocket message envelope.
 * All PartyKit room messages use this structure.
 */
export type WSMessage<TType extends string, TPayload> = {
  type: TType;
  requestId?: string;
  payload: TPayload;
};

// ============================================================================
// Client → Server Events
// ============================================================================

// JOIN_ROOM
export const JoinRoomPayloadSchema = z.object({
  playerToken: z.string(),
});
export type JoinRoomPayload = z.infer<typeof JoinRoomPayloadSchema>;
export type JoinRoomMessage = WSMessage<"JOIN_ROOM", JoinRoomPayload>;

// SET_TARGET_MODE
export const SetTargetModePayloadSchema = z.object({
  mode: TargetingModeSchema,
});
export type SetTargetModePayload = z.infer<typeof SetTargetModePayloadSchema>;
export type SetTargetModeMessage = WSMessage<
  "SET_TARGET_MODE",
  SetTargetModePayload
>;

// UPDATE_SETTINGS (host-only, lobby-only)
export const UpdateSettingsPayloadSchema = z.object({
  patch: RoomSettingsSchema.partial(),
});
export type UpdateSettingsPayload = z.infer<typeof UpdateSettingsPayloadSchema>;
export type UpdateSettingsMessage = WSMessage<
  "UPDATE_SETTINGS",
  UpdateSettingsPayload
>;

// START_MATCH (host-only, lobby-only)
export const StartMatchPayloadSchema = z.object({});
export type StartMatchPayload = z.infer<typeof StartMatchPayloadSchema>;
export type StartMatchMessage = WSMessage<"START_MATCH", StartMatchPayload>;

// RETURN_TO_LOBBY (host-only, ended-only)
export const ReturnToLobbyPayloadSchema = z.object({});
export type ReturnToLobbyPayload = z.infer<typeof ReturnToLobbyPayloadSchema>;
export type ReturnToLobbyMessage = WSMessage<
  "RETURN_TO_LOBBY",
  ReturnToLobbyPayload
>;

// ADD_BOTS (host-only, lobby-only)
export const AddBotsPayloadSchema = z.object({
  count: z.number().int().min(1).max(10),
});
export type AddBotsPayload = z.infer<typeof AddBotsPayloadSchema>;
export type AddBotsMessage = WSMessage<"ADD_BOTS", AddBotsPayload>;

// SEND_CHAT (lobby-only)
export const SendChatPayloadSchema = z.object({
  text: z.string().min(1).max(200),
});
export type SendChatPayload = z.infer<typeof SendChatPayloadSchema>;
export type SendChatMessage = WSMessage<"SEND_CHAT", SendChatPayload>;

// RUN_CODE (optional server fallback)
export const RunCodePayloadSchema = z.object({
  problemId: z.string(),
  code: z.string().max(50000),
});
export type RunCodePayload = z.infer<typeof RunCodePayloadSchema>;
export type RunCodeMessage = WSMessage<"RUN_CODE", RunCodePayload>;

// SUBMIT_CODE
export const SubmitCodePayloadSchema = z.object({
  problemId: z.string(),
  code: z.string().max(50000),
});
export type SubmitCodePayload = z.infer<typeof SubmitCodePayloadSchema>;
export type SubmitCodeMessage = WSMessage<"SUBMIT_CODE", SubmitCodePayload>;

// SPEND_POINTS
export const SpendPointsPayloadSchema = z.object({
  item: ShopItemSchema,
});
export type SpendPointsPayload = z.infer<typeof SpendPointsPayloadSchema>;
export type SpendPointsMessage = WSMessage<"SPEND_POINTS", SpendPointsPayload>;

// SPECTATE_PLAYER
export const SpectatePlayerPayloadSchema = z.object({
  playerId: z.string(),
});
export type SpectatePlayerPayload = z.infer<typeof SpectatePlayerPayloadSchema>;
export type SpectatePlayerMessage = WSMessage<
  "SPECTATE_PLAYER",
  SpectatePlayerPayload
>;

// STOP_SPECTATE
export const StopSpectatePayloadSchema = z.object({});
export type StopSpectatePayload = z.infer<typeof StopSpectatePayloadSchema>;
export type StopSpectateMessage = WSMessage<
  "STOP_SPECTATE",
  StopSpectatePayload
>;

// CODE_UPDATE (editor streaming)
export const CodeUpdateClientPayloadSchema = z.object({
  problemId: z.string(),
  code: z.string().max(50000),
  codeVersion: z.number().int().min(1),
});
export type CodeUpdateClientPayload = z.infer<
  typeof CodeUpdateClientPayloadSchema
>;
export type CodeUpdateClientMessage = WSMessage<
  "CODE_UPDATE",
  CodeUpdateClientPayload
>;

// DEBUG_ADD_SCORE (dev/testing only)
export const DebugAddScorePayloadSchema = z.object({
  amount: z.number().int(),
});
export type DebugAddScorePayload = z.infer<typeof DebugAddScorePayloadSchema>;
export type DebugAddScoreMessage = WSMessage<
  "DEBUG_ADD_SCORE",
  DebugAddScorePayload
>;

// Union of all client messages
export type ClientMessage =
  | JoinRoomMessage
  | SetTargetModeMessage
  | UpdateSettingsMessage
  | StartMatchMessage
  | ReturnToLobbyMessage
  | AddBotsMessage
  | SendChatMessage
  | RunCodeMessage
  | SubmitCodeMessage
  | SpendPointsMessage
  | SpectatePlayerMessage
  | StopSpectateMessage
  | CodeUpdateClientMessage
  | DebugAddScoreMessage;

export const ClientMessageTypeSchema = z.enum([
  "JOIN_ROOM",
  "SET_TARGET_MODE",
  "UPDATE_SETTINGS",
  "START_MATCH",
  "RETURN_TO_LOBBY",
  "ADD_BOTS",
  "SEND_CHAT",
  "RUN_CODE",
  "SUBMIT_CODE",
  "SPEND_POINTS",
  "SPECTATE_PLAYER",
  "STOP_SPECTATE",
  "CODE_UPDATE",
  "DEBUG_ADD_SCORE",
]);
export type ClientMessageType = z.infer<typeof ClientMessageTypeSchema>;

// ============================================================================
// Server → Client Events
// ============================================================================

// ROOM_SNAPSHOT
export const RoomSnapshotPayloadSchema = z.object({
  roomId: z.string(),
  serverTime: z.string().datetime(),
  me: z.object({
    playerId: z.string(),
    username: z.string(),
    role: PlayerRoleSchema,
    isHost: z.boolean(),
    status: PlayerStatusSchema,
  }),
  players: z.array(PlayerPublicSchema),
  match: MatchPublicSchema,
  shopCatalog: z.array(ShopCatalogItemSchema).optional(),
  self: PlayerPrivateStateSchema.optional(),
  spectating: SpectateViewSchema.nullable().optional(),
  chat: z.array(ChatMessageSchema),
  eventLog: z.array(EventLogEntrySchema),
});
export type RoomSnapshotPayload = z.infer<typeof RoomSnapshotPayloadSchema>;
export type RoomSnapshotMessage = WSMessage<
  "ROOM_SNAPSHOT",
  RoomSnapshotPayload
>;

// SETTINGS_UPDATE
export const SettingsUpdatePayloadSchema = z.object({
  settings: RoomSettingsSchema,
});
export type SettingsUpdatePayload = z.infer<typeof SettingsUpdatePayloadSchema>;
export type SettingsUpdateMessage = WSMessage<
  "SETTINGS_UPDATE",
  SettingsUpdatePayload
>;

// MATCH_STARTED
export const MatchStartedPayloadSchema = z.object({
  match: MatchPublicSchema,
});
export type MatchStartedPayload = z.infer<typeof MatchStartedPayloadSchema>;
export type MatchStartedMessage = WSMessage<
  "MATCH_STARTED",
  MatchStartedPayload
>;

// MATCH_PHASE_UPDATE
export const MatchPhaseUpdatePayloadSchema = z.object({
  matchId: z.string(),
  phase: z.enum(["lobby", "warmup", "main", "boss", "ended"]),
});
export type MatchPhaseUpdatePayload = z.infer<
  typeof MatchPhaseUpdatePayloadSchema
>;
export type MatchPhaseUpdateMessage = WSMessage<
  "MATCH_PHASE_UPDATE",
  MatchPhaseUpdatePayload
>;

// PLAYER_UPDATE
export const PlayerUpdatePayloadSchema = z.object({
  player: PlayerPublicSchema,
});
export type PlayerUpdatePayload = z.infer<typeof PlayerUpdatePayloadSchema>;
export type PlayerUpdateMessage = WSMessage<
  "PLAYER_UPDATE",
  PlayerUpdatePayload
>;

// JUDGE_RESULT
export const JudgeResultPayloadSchema = JudgeResultSchema;
export type JudgeResultPayload = z.infer<typeof JudgeResultPayloadSchema>;
export type JudgeResultMessage = WSMessage<"JUDGE_RESULT", JudgeResultPayload>;

// STACK_UPDATE
export const StackUpdatePayloadSchema = z.object({
  playerId: z.string(),
  stackSize: z.number().int().min(0),
});
export type StackUpdatePayload = z.infer<typeof StackUpdatePayloadSchema>;
export type StackUpdateMessage = WSMessage<"STACK_UPDATE", StackUpdatePayload>;

// CHAT_APPEND
export const ChatAppendPayloadSchema = z.object({
  message: ChatMessageSchema,
});
export type ChatAppendPayload = z.infer<typeof ChatAppendPayloadSchema>;
export type ChatAppendMessage = WSMessage<"CHAT_APPEND", ChatAppendPayload>;

// ATTACK_RECEIVED
export const AttackReceivedPayloadSchema = z.object({
  type: AttackTypeSchema,
  fromPlayerId: z.string(),
  endsAt: z.string().datetime().optional(),
  addedProblem: ProblemSummarySchema.optional(),
});
export type AttackReceivedPayload = z.infer<typeof AttackReceivedPayloadSchema>;
export type AttackReceivedMessage = WSMessage<
  "ATTACK_RECEIVED",
  AttackReceivedPayload
>;

// EVENT_LOG_APPEND
export const EventLogAppendPayloadSchema = z.object({
  entry: EventLogEntrySchema,
});
export type EventLogAppendPayload = z.infer<typeof EventLogAppendPayloadSchema>;
export type EventLogAppendMessage = WSMessage<
  "EVENT_LOG_APPEND",
  EventLogAppendPayload
>;

// SPECTATE_STATE
export const SpectateStatePayloadSchema = z.object({
  spectating: SpectateViewSchema.nullable(),
});
export type SpectateStatePayload = z.infer<typeof SpectateStatePayloadSchema>;
export type SpectateStateMessage = WSMessage<
  "SPECTATE_STATE",
  SpectateStatePayload
>;

// CODE_UPDATE (relayed to spectators)
export const CodeUpdateServerPayloadSchema = z.object({
  playerId: z.string(),
  problemId: z.string(),
  code: z.string(),
  codeVersion: z.number().int(),
});
export type CodeUpdateServerPayload = z.infer<
  typeof CodeUpdateServerPayloadSchema
>;
export type CodeUpdateServerMessage = WSMessage<
  "CODE_UPDATE",
  CodeUpdateServerPayload
>;

// MATCH_END
export const MatchEndPayloadSchema = z.object({
  matchId: z.string(),
  endReason: z.enum(["lastAlive", "timeExpired"]),
  winnerPlayerId: z.string(),
  standings: z.array(StandingEntrySchema),
});
export type MatchEndPayload = z.infer<typeof MatchEndPayloadSchema>;
export type MatchEndMessage = WSMessage<"MATCH_END", MatchEndPayload>;

// ERROR
export const ErrorPayloadSchema = z.object({
  code: z.string(),
  message: z.string(),
  retryAfterMs: z.number().int().optional(),
  details: z.unknown().optional(),
});
export type ErrorPayload = z.infer<typeof ErrorPayloadSchema>;
export type ErrorMessage = WSMessage<"ERROR", ErrorPayload>;

// Union of all server messages
export type ServerMessage =
  | RoomSnapshotMessage
  | SettingsUpdateMessage
  | MatchStartedMessage
  | MatchPhaseUpdateMessage
  | PlayerUpdateMessage
  | JudgeResultMessage
  | StackUpdateMessage
  | ChatAppendMessage
  | AttackReceivedMessage
  | EventLogAppendMessage
  | SpectateStateMessage
  | CodeUpdateServerMessage
  | MatchEndMessage
  | ErrorMessage;

export const ServerMessageTypeSchema = z.enum([
  "ROOM_SNAPSHOT",
  "SETTINGS_UPDATE",
  "MATCH_STARTED",
  "MATCH_PHASE_UPDATE",
  "PLAYER_UPDATE",
  "JUDGE_RESULT",
  "STACK_UPDATE",
  "CHAT_APPEND",
  "ATTACK_RECEIVED",
  "EVENT_LOG_APPEND",
  "SPECTATE_STATE",
  "CODE_UPDATE",
  "MATCH_END",
  "ERROR",
]);
export type ServerMessageType = z.infer<typeof ServerMessageTypeSchema>;

// ============================================================================
// Canonical Error Codes
// ============================================================================

export const ErrorCodeSchema = z.enum([
  "BAD_REQUEST",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "ROOM_NOT_FOUND",
  "ROOM_FULL",
  "USERNAME_TAKEN",
  "MATCH_ALREADY_STARTED",
  "MATCH_NOT_STARTED",
  "MATCH_NOT_FOUND",
  "PLAYER_NOT_FOUND",
  "PLAYER_ELIMINATED",
  "PROBLEM_NOT_FOUND",
  "INSUFFICIENT_SCORE",
  "ITEM_ON_COOLDOWN",
  "RATE_LIMITED",
  "PAYLOAD_TOO_LARGE",
  "JUDGE_UNAVAILABLE",
  "INTERNAL_ERROR",
]);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;
