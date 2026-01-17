/**
 * Pure functions extracted from Room class for testing.
 * These functions contain the core game logic without PartyKit dependencies.
 */

import type {
  AttackType,
  DebuffType,
  DifficultyProfile,
  MatchPhase,
  PlayerPublic,
  ProblemFull,
  RoomSettings,
  ShopItem,
  TargetingMode,
} from "@leet99/contracts";

// ============================================================================
// Rate Limiting
// ============================================================================

export interface RateLimitConfig {
  intervalMs: number;
  maxRequests: number;
}

export interface RateLimitState {
  lastRequestAt: number;
  requestCount: number;
}

export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  RUN_CODE: { intervalMs: 2000, maxRequests: 1 },
  SUBMIT_CODE: { intervalMs: 3000, maxRequests: 1 },
  CODE_UPDATE: { intervalMs: 100, maxRequests: 10 },
  SPECTATE_PLAYER: { intervalMs: 1000, maxRequests: 1 },
  SEND_CHAT: { intervalMs: 500, maxRequests: 2 },
};

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs?: number;
  newState: RateLimitState;
}

/**
 * Check if a request is allowed based on rate limiting rules.
 * Pure function that returns the new state.
 */
export function checkRateLimit(
  action: string,
  currentState: RateLimitState | undefined,
  now: number,
): RateLimitResult {
  const limit = RATE_LIMITS[action];
  if (!limit) {
    return {
      allowed: true,
      newState: currentState ?? { lastRequestAt: now, requestCount: 1 },
    };
  }

  if (!currentState) {
    return {
      allowed: true,
      newState: { lastRequestAt: now, requestCount: 1 },
    };
  }

  const elapsed = now - currentState.lastRequestAt;

  if (elapsed >= limit.intervalMs) {
    // Reset window
    return {
      allowed: true,
      newState: { lastRequestAt: now, requestCount: 1 },
    };
  }

  if (currentState.requestCount >= limit.maxRequests) {
    const retryAfterMs = limit.intervalMs - elapsed;
    return {
      allowed: false,
      retryAfterMs,
      newState: currentState,
    };
  }

  return {
    allowed: true,
    newState: {
      lastRequestAt: currentState.lastRequestAt,
      requestCount: currentState.requestCount + 1,
    },
  };
}

// ============================================================================
// Scoring
// ============================================================================

export const DIFFICULTY_SCORES: Record<"easy" | "medium" | "hard", number> = {
  easy: 5,
  medium: 10,
  hard: 20,
};

/**
 * Calculate points for solving a problem.
 */
export function calculateScore(
  difficulty: "easy" | "medium" | "hard",
  isGarbage: boolean,
): number {
  if (isGarbage) return 0;
  return DIFFICULTY_SCORES[difficulty] ?? 0;
}

// ============================================================================
// Attack System
// ============================================================================

export const BASE_DEBUFF_DURATIONS: Record<DebuffType, number> = {
  ddos: 12000,
  flashbang: 25000,
  vimLock: 12000,
  memoryLeak: 30000,
};

export const DEBUFF_GRACE_PERIOD_MS = 5000;

/**
 * Determine attack type based on difficulty and streak.
 */
export function determineAttackType(
  difficulty: "easy" | "medium" | "hard",
  streak: number,
  randomValue?: number, // For deterministic testing
): AttackType {
  // If streak is multiple of 3, send memoryLeak
  if (streak > 0 && streak % 3 === 0) {
    return "memoryLeak";
  }

  switch (difficulty) {
    case "easy":
      return "garbageDrop";
    case "medium": {
      const rand = randomValue ?? Math.random();
      return rand < 0.5 ? "flashbang" : "vimLock";
    }
    case "hard":
      return "ddos";
    default:
      return "garbageDrop";
  }
}

/**
 * Calculate debuff duration with intensity scaling.
 */
export function calculateDebuffDuration(
  debuffType: DebuffType,
  attackIntensity: "low" | "high",
): number {
  const baseDuration = BASE_DEBUFF_DURATIONS[debuffType];
  if (attackIntensity === "high") {
    return Math.round(baseDuration * 1.3);
  }
  return baseDuration;
}

/**
 * Check if target is immune due to grace period.
 */
export function isInGracePeriod(
  debuffGraceEndsAt: number | undefined,
  now: number,
): boolean {
  return debuffGraceEndsAt !== undefined && now < debuffGraceEndsAt;
}

// ============================================================================
// Targeting Algorithm
// ============================================================================

export interface TargetCandidate {
  playerId: string;
  score: number;
  stackSize: number;
}

export interface AttackerInfo {
  playerId: string;
  lastAttackedAt: number;
}

/**
 * Select a target based on targeting mode.
 * Pure function for testing.
 */
export function selectTarget(
  mode: TargetingMode,
  validTargets: TargetCandidate[],
  stackLimit: number,
  recentAttackers: AttackerInfo[],
  now: number,
  randomValue?: number, // For deterministic testing
): TargetCandidate | null {
  if (validTargets.length === 0) {
    return null;
  }

  const rand = randomValue ?? Math.random();

  switch (mode) {
    case "random": {
      const index = Math.floor(rand * validTargets.length);
      return validTargets[index] ?? null;
    }

    case "attackers": {
      // Find recent attackers (within 20s)
      const recentAttackerIds = new Set(
        recentAttackers
          .filter((a) => now - a.lastAttackedAt <= 20000)
          .map((a) => a.playerId),
      );
      const candidates = validTargets.filter((t) =>
        recentAttackerIds.has(t.playerId),
      );
      if (candidates.length > 0) {
        const index = Math.floor(rand * candidates.length);
        return candidates[index] ?? null;
      }
      // Fallback to random
      const fallbackIndex = Math.floor(rand * validTargets.length);
      return validTargets[fallbackIndex] ?? null;
    }

    case "topScore": {
      const maxScore = Math.max(...validTargets.map((t) => t.score));
      const topScorers = validTargets.filter((t) => t.score === maxScore);
      const index = Math.floor(rand * topScorers.length);
      return topScorers[index] ?? null;
    }

    case "nearDeath": {
      const ratios = validTargets.map((t) => ({
        target: t,
        ratio: t.stackSize / stackLimit,
      }));
      const maxRatio = Math.max(...ratios.map((r) => r.ratio));
      const nearDeathPlayers = ratios.filter((r) => r.ratio === maxRatio);
      const index = Math.floor(rand * nearDeathPlayers.length);
      return nearDeathPlayers[index]?.target ?? null;
    }

    default:
      return validTargets[Math.floor(rand * validTargets.length)] ?? null;
  }
}

// ============================================================================
// Match End Logic
// ============================================================================

export interface MatchParticipant {
  playerId: string;
  username: string;
  role: "player" | "bot" | "spectator";
  status: "lobby" | "coding" | "error" | "underAttack" | "eliminated";
  score: number;
  stackSize: number;
}

export interface StandingEntry {
  rank: number;
  playerId: string;
  username: string;
  role: "player" | "bot";
  score: number;
}

export interface MatchEndResult {
  endReason: "lastAlive" | "timeExpired";
  winnerPlayerId: string;
  standings: StandingEntry[];
}

/**
 * Compute match standings and winner.
 */
export function computeMatchEnd(
  participants: MatchParticipant[],
  endReason: "lastAlive" | "timeExpired",
): MatchEndResult {
  // Filter out spectators
  const nonSpectators = participants.filter((p) => p.role !== "spectator");

  // Sort by: alive first, then score desc, then stackSize asc, then playerId
  const sorted = [...nonSpectators].sort((a, b) => {
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

  let winnerPlayerId: string;
  if (endReason === "lastAlive") {
    const alive = sorted.find((p) => p.status !== "eliminated");
    winnerPlayerId = alive?.playerId ?? sorted[0]?.playerId ?? "";
  } else {
    winnerPlayerId = sorted[0]?.playerId ?? "";
  }

  const standings: StandingEntry[] = sorted.map((p, i) => ({
    rank: i + 1,
    playerId: p.playerId,
    username: p.username,
    role: p.role as "player" | "bot",
    score: p.score,
  }));

  return {
    endReason,
    winnerPlayerId,
    standings,
  };
}

/**
 * Check if match should end.
 */
export function shouldMatchEnd(
  phase: MatchPhase,
  endAt: string | undefined,
  aliveCount: number,
  now: Date,
): { shouldEnd: boolean; reason?: "lastAlive" | "timeExpired" } {
  if (phase === "lobby" || phase === "ended") {
    return { shouldEnd: false };
  }

  // Check last alive
  if (aliveCount <= 1) {
    return { shouldEnd: true, reason: "lastAlive" };
  }

  // Check time expired
  if (endAt && new Date(endAt) <= now) {
    return { shouldEnd: true, reason: "timeExpired" };
  }

  return { shouldEnd: false };
}

// ============================================================================
// Shop System
// ============================================================================

export interface ShopCatalogItem {
  item: ShopItem;
  cost: number;
  cooldownSec?: number;
}

export const DEFAULT_SHOP_CATALOG: ShopCatalogItem[] = [
  { item: "clearDebuff", cost: 10 },
  { item: "memoryDefrag", cost: 10 },
  { item: "skipProblem", cost: 15 },
  { item: "rateLimiter", cost: 10, cooldownSec: 60 },
  { item: "hint", cost: 5 },
];

export interface ShopPurchaseCheck {
  canPurchase: boolean;
  errorCode?: "INSUFFICIENT_SCORE" | "ITEM_ON_COOLDOWN" | "BAD_REQUEST";
  retryAfterMs?: number;
}

/**
 * Check if a shop item can be purchased.
 */
export function canPurchaseItem(
  item: ShopItem,
  playerScore: number,
  cooldownEndsAt: number | undefined,
  now: number,
): ShopPurchaseCheck {
  const catalogItem = DEFAULT_SHOP_CATALOG.find((c) => c.item === item);
  if (!catalogItem) {
    return { canPurchase: false, errorCode: "BAD_REQUEST" };
  }

  if (playerScore < catalogItem.cost) {
    return { canPurchase: false, errorCode: "INSUFFICIENT_SCORE" };
  }

  if (cooldownEndsAt && now < cooldownEndsAt) {
    return {
      canPurchase: false,
      errorCode: "ITEM_ON_COOLDOWN",
      retryAfterMs: cooldownEndsAt - now,
    };
  }

  return { canPurchase: true };
}

// ============================================================================
// Problem Arrival Timing
// ============================================================================

/**
 * Calculate problem arrival interval based on phase and buffs/debuffs.
 */
export function calculateProblemArrivalInterval(
  phase: MatchPhase,
  hasMemoryLeak: boolean,
  hasRateLimiter: boolean,
): number {
  // Base interval based on phase
  const baseIntervalSec = phase === "warmup" ? 90 : 60;

  // Apply multipliers
  const memoryLeakMultiplier = hasMemoryLeak ? 0.5 : 1;
  const rateLimiterMultiplier = hasRateLimiter ? 2 : 1;

  const effectiveIntervalSec =
    baseIntervalSec * memoryLeakMultiplier * rateLimiterMultiplier;

  return effectiveIntervalSec * 1000; // Convert to milliseconds
}

// ============================================================================
// Difficulty Weights
// ============================================================================

export const DIFFICULTY_WEIGHTS: Record<
  DifficultyProfile,
  Record<"easy" | "medium" | "hard", number>
> = {
  beginner: { easy: 70, medium: 25, hard: 5 },
  moderate: { easy: 40, medium: 40, hard: 20 },
  competitive: { easy: 20, medium: 40, hard: 40 },
};

/**
 * Get difficulty weights for a profile.
 */
export function getDifficultyWeights(
  profile: DifficultyProfile,
): Record<"easy" | "medium" | "hard", number> {
  return DIFFICULTY_WEIGHTS[profile];
}

// ============================================================================
// Stack Management
// ============================================================================

/**
 * Check if adding a problem would cause stack overflow.
 */
export function wouldOverflow(
  currentStackSize: number,
  stackLimit: number,
): boolean {
  return currentStackSize >= stackLimit;
}

// ============================================================================
// Bot Simulation
// ============================================================================

/**
 * Calculate next bot action time based on problem difficulty.
 */
export function calculateBotSolveTime(
  difficulty: "easy" | "medium" | "hard",
  randomValue?: number, // For deterministic testing
): number {
  const rand = randomValue ?? Math.random();

  let minTime: number;
  let maxTime: number;

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

  return minTime + rand * (maxTime - minTime);
}

/**
 * Determine if bot submission passes (80% success rate).
 */
export function botSubmissionPasses(randomValue?: number): boolean {
  const rand = randomValue ?? Math.random();
  return rand > 0.2;
}
