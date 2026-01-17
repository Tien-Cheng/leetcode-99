import { z } from "zod";

// ============================================================================
// Room Settings
// ============================================================================

export const DifficultyProfileSchema = z.enum([
  "beginner",
  "moderate",
  "competitive",
]);
export type DifficultyProfile = z.infer<typeof DifficultyProfileSchema>;

export const AttackIntensitySchema = z.enum(["low", "high"]);
export type AttackIntensity = z.infer<typeof AttackIntensitySchema>;

export const RoomSettingsSchema = z.object({
  matchDurationSec: z.number().int().min(3).max(600).default(600),
  playerCap: z.number().int().min(2).max(99).default(8),
  stackLimit: z.number().int().min(5).max(20).default(10),
  startingQueued: z.number().int().min(1).max(5).default(2),
  difficultyProfile: DifficultyProfileSchema.default("moderate"),
  attackIntensity: AttackIntensitySchema.default("low"),
});
export type RoomSettings = z.infer<typeof RoomSettingsSchema>;

// ============================================================================
// Player Types
// ============================================================================

export const PlayerRoleSchema = z.enum(["player", "bot", "spectator"]);
export type PlayerRole = z.infer<typeof PlayerRoleSchema>;

export const PlayerStatusSchema = z.enum([
  "lobby",
  "coding",
  "error",
  "underAttack",
  "eliminated",
]);
export type PlayerStatus = z.infer<typeof PlayerStatusSchema>;

export const TargetingModeSchema = z.enum([
  "random",
  "attackers",
  "topScore",
  "nearDeath",
  "rankAbove",
]);
export type TargetingMode = z.infer<typeof TargetingModeSchema>;

export const DebuffTypeSchema = z.enum([
  "ddos",
  "flashbang",
  "vimLock",
  "memoryLeak",
]);
export type DebuffType = z.infer<typeof DebuffTypeSchema>;

export const AttackTypeSchema = z.enum([
  "ddos",
  "flashbang",
  "vimLock",
  "memoryLeak",
  "garbageDrop",
]);
export type AttackType = z.infer<typeof AttackTypeSchema>;

export const ActiveDebuffSchema = z.object({
  type: DebuffTypeSchema,
  endsAt: z.string().datetime(),
});
export type ActiveDebuff = z.infer<typeof ActiveDebuffSchema>;

export const BuffTypeSchema = z.enum(["rateLimiter"]);
export type BuffType = z.infer<typeof BuffTypeSchema>;

export const ActiveBuffSchema = z.object({
  type: BuffTypeSchema,
  endsAt: z.string().datetime(),
});
export type ActiveBuff = z.infer<typeof ActiveBuffSchema>;

export const PlayerPublicSchema = z.object({
  playerId: z.string(),
  username: z.string().min(1).max(16),
  role: PlayerRoleSchema,
  status: PlayerStatusSchema,
  isHost: z.boolean(),
  score: z.number().int().min(0),
  streak: z.number().int().min(0),
  targetingMode: TargetingModeSchema,
  stackSize: z.number().int().min(0),
  activeDebuff: ActiveDebuffSchema.nullable().optional(),
  activeBuff: ActiveBuffSchema.nullable().optional(),
});
export type PlayerPublic = z.infer<typeof PlayerPublicSchema>;

// ============================================================================
// Match Standings
// ============================================================================

export const StandingEntrySchema = z.object({
  rank: z.number().int().min(1),
  playerId: z.string(),
  username: z.string(),
  role: PlayerRoleSchema,
  score: z.number().int(),
  status: z.string().optional(),
});
export type StandingEntry = z.infer<typeof StandingEntrySchema>;

// ============================================================================
// Match State
// ============================================================================

export const MatchPhaseSchema = z.enum([
  "lobby",
  "warmup",
  "main",
  "boss",
  "ended",
]);
export type MatchPhase = z.infer<typeof MatchPhaseSchema>;

export const MatchEndReasonSchema = z.enum(["lastAlive", "timeExpired"]);
export type MatchEndReason = z.infer<typeof MatchEndReasonSchema>;

export const MatchPublicSchema = z.object({
  matchId: z.string().nullable(),
  phase: MatchPhaseSchema,
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  endReason: MatchEndReasonSchema.optional(),
  settings: RoomSettingsSchema,
  standings: z.array(StandingEntrySchema).optional(),
});
export type MatchPublic = z.infer<typeof MatchPublicSchema>;

// ============================================================================
// Chat
// ============================================================================

export const ChatMessageKindSchema = z.enum(["user", "system"]);
export type ChatMessageKind = z.infer<typeof ChatMessageKindSchema>;

export const ChatMessageSchema = z.object({
  id: z.string(),
  at: z.string().datetime(),
  kind: ChatMessageKindSchema,
  text: z.string().min(1).max(200),
  fromPlayerId: z.string().optional(),
  fromUsername: z.string().optional(),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

// ============================================================================
// Event Log
// ============================================================================

export const EventLogLevelSchema = z.enum(["info", "warning", "error"]);
export type EventLogLevel = z.infer<typeof EventLogLevelSchema>;

export const EventLogEntrySchema = z.object({
  id: z.string(),
  at: z.string().datetime(),
  level: EventLogLevelSchema,
  message: z.string(),
});
export type EventLogEntry = z.infer<typeof EventLogEntrySchema>;

// ============================================================================
// Shop
// ============================================================================

export const ShopItemSchema = z.enum([
  "clearDebuff",
  "memoryDefrag",
  "skipProblem",
  "rateLimiter",
  "hint",
]);
export type ShopItem = z.infer<typeof ShopItemSchema>;

export const ShopCatalogItemSchema = z.object({
  item: ShopItemSchema,
  cost: z.number().int().min(0),
  cooldownSec: z.number().int().min(0).optional(),
});
export type ShopCatalogItem = z.infer<typeof ShopCatalogItemSchema>;

// Default shop catalog (MVP)
export const DEFAULT_SHOP_CATALOG: ShopCatalogItem[] = [
  { item: "clearDebuff", cost: 10 },
  { item: "memoryDefrag", cost: 10 },
  { item: "skipProblem", cost: 15 },
  { item: "rateLimiter", cost: 10, cooldownSec: 60 },
  { item: "hint", cost: 5 },
];

