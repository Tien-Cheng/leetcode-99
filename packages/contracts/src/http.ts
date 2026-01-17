import { z } from "zod";
import {
  RoomSettingsSchema,
  PlayerRoleSchema,
  MatchPhaseSchema,
  MatchEndReasonSchema,
  StandingEntrySchema,
} from "./room.js";

// ============================================================================
// HTTP Request/Response Schemas
// ============================================================================

export const UsernameSchema = z.string().min(1).max(16);

// POST /api/rooms - Create Room
export const CreateRoomRequestSchema = z.object({
  username: UsernameSchema,
  settings: RoomSettingsSchema.partial().optional(),
});
export type CreateRoomRequest = z.infer<typeof CreateRoomRequestSchema>;

export const CreateRoomResponseSchema = z.object({
  roomId: z.string(),
  wsUrl: z.string().url(),
  playerId: z.string(),
  playerToken: z.string(),
  role: PlayerRoleSchema.extract(["player"]),
  isHost: z.literal(true),
  settings: RoomSettingsSchema,
});
export type CreateRoomResponse = z.infer<typeof CreateRoomResponseSchema>;

// POST /api/rooms/:roomId/join - Join Room
export const JoinRoomRequestSchema = z.object({
  username: UsernameSchema,
  role: PlayerRoleSchema.extract(["player", "spectator"]).default("player"),
});
export type JoinRoomRequest = z.infer<typeof JoinRoomRequestSchema>;

export const JoinRoomResponseSchema = z.object({
  roomId: z.string(),
  wsUrl: z.string().url(),
  playerId: z.string(),
  playerToken: z.string(),
  role: PlayerRoleSchema.extract(["player", "spectator"]),
  isHost: z.boolean(),
  settings: RoomSettingsSchema,
});
export type JoinRoomResponse = z.infer<typeof JoinRoomResponseSchema>;

export const RoomCountsSchema = z.object({
  players: z.number().int().min(0),
  spectators: z.number().int().min(0),
});
export type RoomCounts = z.infer<typeof RoomCountsSchema>;

// PartyKit register bridge (HTTP → PartyKit)
export const PartyRegisterRequestSchema = z.object({
  playerId: z.string(),
  playerToken: z.string(),
  username: UsernameSchema,
  role: PlayerRoleSchema.extract(["player", "spectator"]),
  isHost: z.boolean(),
  settings: RoomSettingsSchema.partial().optional(),
});
export type PartyRegisterRequest = z.infer<typeof PartyRegisterRequestSchema>;

export const PartyRegisterResponseSchema = z.object({
  roomId: z.string(),
  settings: RoomSettingsSchema,
  phase: MatchPhaseSchema,
  counts: RoomCountsSchema,
});
export type PartyRegisterResponse = z.infer<typeof PartyRegisterResponseSchema>;

// GET /api/rooms/:roomId - Room Summary (optional)
export const RoomSummaryResponseSchema = z.object({
  roomId: z.string(),
  phase: MatchPhaseSchema,
  settings: RoomSettingsSchema,
  counts: RoomCountsSchema,
});
export type RoomSummaryResponse = z.infer<typeof RoomSummaryResponseSchema>;

// GET /api/matches/:matchId - Match Results
export const MatchResultsResponseSchema = z.object({
  match: z.object({
    matchId: z.string(),
    roomId: z.string(),
    startAt: z.string().datetime(),
    endAt: z.string().datetime(),
    endReason: MatchEndReasonSchema,
    settings: RoomSettingsSchema,
  }),
  standings: z.array(StandingEntrySchema),
});
export type MatchResultsResponse = z.infer<typeof MatchResultsResponseSchema>;

// GET /api/rooms/:roomId/matches - Room Match History (optional)
export const RoomMatchHistoryResponseSchema = z.object({
  roomId: z.string(),
  matches: z.array(
    z.object({
      matchId: z.string(),
      startAt: z.string().datetime(),
      endAt: z.string().datetime(),
      endReason: MatchEndReasonSchema,
    }),
  ),
});
export type RoomMatchHistoryResponse = z.infer<
  typeof RoomMatchHistoryResponseSchema
>;

// GET /api/leaderboard - Leaderboard (optional)
export const LeaderboardResponseSchema = z.object({
  window: z.string(),
  entries: z.array(
    z.object({
      rank: z.number().int().min(1),
      username: z.string(),
      score: z.number().int(),
      matchId: z.string(),
      at: z.string().datetime(),
    }),
  ),
});
export type LeaderboardResponse = z.infer<typeof LeaderboardResponseSchema>;

// HTTP Error Response
export const HttpErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type HttpErrorResponse = z.infer<typeof HttpErrorResponseSchema>;
