import test from "node:test";
import assert from "node:assert/strict";

import {
  // Rate limiting
  checkRateLimit,
  RATE_LIMITS,
  type RateLimitState,
  // Scoring
  calculateScore,
  DIFFICULTY_SCORES,
  // Attack system
  determineAttackType,
  calculateDebuffDuration,
  isInGracePeriod,
  BASE_DEBUFF_DURATIONS,
  DEBUFF_GRACE_PERIOD_MS,
  // Targeting
  selectTarget,
  type TargetCandidate,
  type AttackerInfo,
  // Match end
  computeMatchEnd,
  shouldMatchEnd,
  type MatchParticipant,
  // Shop
  canPurchaseItem,
  DEFAULT_SHOP_CATALOG,
  // Problem timing
  calculateProblemArrivalInterval,
  // Difficulty weights
  getDifficultyWeights,
  DIFFICULTY_WEIGHTS,
  // Stack management
  wouldOverflow,
  // Bot simulation
  calculateBotSolveTime,
  botSubmissionPasses,
} from "../src/room-logic.ts";

// ============================================================================
// Rate Limiting Tests
// ============================================================================

test("Rate Limiting", async (t) => {
  await t.test("allows first request", () => {
    const result = checkRateLimit("RUN_CODE", undefined, 1000);
    assert.equal(result.allowed, true);
    assert.equal(result.newState.requestCount, 1);
    assert.equal(result.newState.lastRequestAt, 1000);
  });

  await t.test("blocks request when limit reached", () => {
    const state: RateLimitState = { lastRequestAt: 1000, requestCount: 1 };
    const result = checkRateLimit("RUN_CODE", state, 1500); // 500ms later, limit is 1000ms

    assert.equal(result.allowed, false);
    assert.equal(result.retryAfterMs, 500); // 1000 - 500 = 500ms to wait
  });

  await t.test("allows request after interval passes", () => {
    const state: RateLimitState = { lastRequestAt: 1000, requestCount: 1 };
    const result = checkRateLimit("RUN_CODE", state, 2100); // 1100ms later, interval is 1000ms

    assert.equal(result.allowed, true);
    assert.equal(result.newState.requestCount, 1); // Reset
    assert.equal(result.newState.lastRequestAt, 2100);
  });

  await t.test("allows multiple requests within limit (CODE_UPDATE)", () => {
    // CODE_UPDATE allows 20 requests per 100ms
    let state: RateLimitState | undefined;
    const now = 1000;

    for (let i = 0; i < 20; i++) {
      const result = checkRateLimit("CODE_UPDATE", state, now + i);
      assert.equal(result.allowed, true, `Request ${i + 1} should be allowed`);
      state = result.newState;
    }

    // 21st request should be blocked
    const result = checkRateLimit("CODE_UPDATE", state, now + 20);
    assert.equal(result.allowed, false);
  });

  await t.test("allows request for unknown action", () => {
    const result = checkRateLimit("UNKNOWN_ACTION", undefined, 1000);
    assert.equal(result.allowed, true);
  });

  await t.test("SEND_CHAT allows 2 requests per 500ms", () => {
    let state: RateLimitState | undefined;

    // First request
    const r1 = checkRateLimit("SEND_CHAT", state, 1000);
    assert.equal(r1.allowed, true);
    state = r1.newState;

    // Second request
    const r2 = checkRateLimit("SEND_CHAT", state, 1100);
    assert.equal(r2.allowed, true);
    state = r2.newState;

    // Third request should be blocked
    const r3 = checkRateLimit("SEND_CHAT", state, 1200);
    assert.equal(r3.allowed, false);

    // After interval, should be allowed again
    const r4 = checkRateLimit("SEND_CHAT", state, 1600);
    assert.equal(r4.allowed, true);
  });
});

// ============================================================================
// Scoring Tests
// ============================================================================

test("Scoring", async (t) => {
  await t.test("returns correct score for easy", () => {
    assert.equal(calculateScore("easy", false), 5);
  });

  await t.test("returns correct score for medium", () => {
    assert.equal(calculateScore("medium", false), 10);
  });

  await t.test("returns correct score for hard", () => {
    assert.equal(calculateScore("hard", false), 20);
  });

  await t.test("returns 0 for garbage problems", () => {
    assert.equal(calculateScore("easy", true), 0);
    assert.equal(calculateScore("medium", true), 0);
    assert.equal(calculateScore("hard", true), 0);
  });
});

// ============================================================================
// Attack System Tests
// ============================================================================

test("Attack Type Determination", async (t) => {
  await t.test("easy difficulty returns garbageDrop", () => {
    assert.equal(determineAttackType("easy", 1), "garbageDrop");
    assert.equal(determineAttackType("easy", 2), "garbageDrop");
  });

  await t.test("medium difficulty returns flashbang or vimLock", () => {
    // With deterministic random
    assert.equal(determineAttackType("medium", 1, 0.3), "flashbang"); // < 0.5
    assert.equal(determineAttackType("medium", 1, 0.7), "vimLock"); // >= 0.5
  });

  await t.test("hard difficulty returns ddos", () => {
    assert.equal(determineAttackType("hard", 1), "ddos");
    assert.equal(determineAttackType("hard", 2), "ddos");
  });

  await t.test("streak multiple of 3 returns memoryLeak (overrides difficulty)", () => {
    assert.equal(determineAttackType("easy", 3), "memoryLeak");
    assert.equal(determineAttackType("medium", 6), "memoryLeak");
    assert.equal(determineAttackType("hard", 9), "memoryLeak");
  });

  await t.test("streak of 0 does not return memoryLeak", () => {
    // 0 is technically divisible by 3, but spec says "streak > 0"
    assert.equal(determineAttackType("easy", 0), "garbageDrop");
  });
});

test("Debuff Duration Calculation", async (t) => {
  await t.test("low intensity returns base duration", () => {
    assert.equal(calculateDebuffDuration("ddos", "low"), 12000);
    assert.equal(calculateDebuffDuration("flashbang", "low"), 25000);
    assert.equal(calculateDebuffDuration("vimLock", "low"), 12000);
    assert.equal(calculateDebuffDuration("memoryLeak", "low"), 30000);
  });

  await t.test("high intensity returns 1.3x duration", () => {
    assert.equal(calculateDebuffDuration("ddos", "high"), Math.round(12000 * 1.3)); // 15600
    assert.equal(calculateDebuffDuration("flashbang", "high"), Math.round(25000 * 1.3)); // 32500
    assert.equal(calculateDebuffDuration("vimLock", "high"), Math.round(12000 * 1.3)); // 15600
    assert.equal(calculateDebuffDuration("memoryLeak", "high"), Math.round(30000 * 1.3)); // 39000
  });
});

test("Grace Period Check", async (t) => {
  await t.test("returns true when in grace period", () => {
    const graceEndsAt = 5000;
    assert.equal(isInGracePeriod(graceEndsAt, 3000), true);
    assert.equal(isInGracePeriod(graceEndsAt, 4999), true);
  });

  await t.test("returns false when grace period expired", () => {
    const graceEndsAt = 5000;
    assert.equal(isInGracePeriod(graceEndsAt, 5000), false);
    assert.equal(isInGracePeriod(graceEndsAt, 6000), false);
  });

  await t.test("returns false when no grace period set", () => {
    assert.equal(isInGracePeriod(undefined, 3000), false);
  });
});

// ============================================================================
// Targeting Algorithm Tests
// ============================================================================

test("Target Selection", async (t) => {
  const makeTargets = (): TargetCandidate[] => [
    { playerId: "p1", score: 10, stackSize: 2 },
    { playerId: "p2", score: 20, stackSize: 5 },
    { playerId: "p3", score: 20, stackSize: 3 },
    { playerId: "p4", score: 5, stackSize: 8 },
  ];

  await t.test("returns null for empty targets", () => {
    const result = selectTarget("random", [], 10, [], 1000);
    assert.equal(result, null);
  });

  await t.test("random mode selects based on random value", () => {
    const targets = makeTargets();
    // random = 0 should select first (index 0)
    const r1 = selectTarget("random", targets, 10, [], 1000, 0);
    assert.equal(r1?.playerId, "p1");

    // random = 0.75 should select index 3
    const r2 = selectTarget("random", targets, 10, [], 1000, 0.75);
    assert.equal(r2?.playerId, "p4");
  });

  await t.test("topScore mode selects highest scorer", () => {
    const targets = makeTargets();
    // p2 and p3 both have score 20, should select based on random
    const r1 = selectTarget("topScore", targets, 10, [], 1000, 0);
    assert.equal(r1?.playerId, "p2");

    const r2 = selectTarget("topScore", targets, 10, [], 1000, 0.5);
    assert.equal(r2?.playerId, "p3");
  });

  await t.test("nearDeath mode selects player closest to elimination", () => {
    const targets = makeTargets();
    const stackLimit = 10;
    // p4 has stackSize 8/10 = 0.8 ratio (highest)
    const result = selectTarget("nearDeath", targets, stackLimit, [], 1000, 0);
    assert.equal(result?.playerId, "p4");
  });

  await t.test("attackers mode prefers recent attackers", () => {
    const targets = makeTargets();
    const attackers: AttackerInfo[] = [
      { playerId: "p1", lastAttackedAt: 800 }, // 200ms ago - recent
      { playerId: "p3", lastAttackedAt: 500 }, // 500ms ago - recent
    ];
    const now = 1000;

    // Should select from recent attackers (p1 or p3)
    const r1 = selectTarget("attackers", targets, 10, attackers, now, 0);
    assert.equal(r1?.playerId, "p1");

    const r2 = selectTarget("attackers", targets, 10, attackers, now, 0.5);
    assert.equal(r2?.playerId, "p3");
  });

  await t.test("attackers mode falls back to random when no recent attackers", () => {
    const targets = makeTargets();
    const attackers: AttackerInfo[] = [
      { playerId: "p1", lastAttackedAt: 100 }, // 25s ago - too old
    ];
    const now = 25100;

    // Should fall back to random
    const result = selectTarget("attackers", targets, 10, attackers, now, 0);
    assert.equal(result?.playerId, "p1");
  });

  await t.test("attackers mode window is exactly 20s", () => {
    const targets = makeTargets();

    // Exactly at 20s boundary
    const attackers: AttackerInfo[] = [
      { playerId: "p1", lastAttackedAt: 0 },
    ];

    // At 20000ms, attack was exactly 20s ago - should still be valid
    const r1 = selectTarget("attackers", targets, 10, attackers, 20000, 0);
    assert.equal(r1?.playerId, "p1");

    // At 20001ms, attack was 20.001s ago - should not be valid
    const r2 = selectTarget("attackers", targets, 10, attackers, 20001, 0);
    // Should fall back to random, selecting from all targets
    assert.notEqual(r2, null);
  });
});

// ============================================================================
// Match End Logic Tests
// ============================================================================

test("Match End Computation", async (t) => {
  await t.test("computes correct standings by score", () => {
    const participants: MatchParticipant[] = [
      { playerId: "p1", username: "Alice", role: "player", status: "coding", score: 10, stackSize: 2 },
      { playerId: "p2", username: "Bob", role: "player", status: "coding", score: 30, stackSize: 3 },
      { playerId: "p3", username: "Carol", role: "bot", status: "coding", score: 20, stackSize: 1 },
    ];

    const result = computeMatchEnd(participants, "timeExpired");

    assert.equal(result.winnerPlayerId, "p2"); // Highest score
    assert.equal(result.standings.length, 3);
    assert.equal(result.standings[0].playerId, "p2");
    assert.equal(result.standings[0].rank, 1);
    assert.equal(result.standings[1].playerId, "p3");
    assert.equal(result.standings[1].rank, 2);
    assert.equal(result.standings[2].playerId, "p1");
    assert.equal(result.standings[2].rank, 3);
  });

  await t.test("alive players ranked above eliminated", () => {
    const participants: MatchParticipant[] = [
      { playerId: "p1", username: "Alice", role: "player", status: "eliminated", score: 100, stackSize: 0 },
      { playerId: "p2", username: "Bob", role: "player", status: "coding", score: 10, stackSize: 3 },
    ];

    const result = computeMatchEnd(participants, "timeExpired");

    assert.equal(result.winnerPlayerId, "p2"); // Alive beats eliminated
    assert.equal(result.standings[0].playerId, "p2");
    assert.equal(result.standings[1].playerId, "p1");
  });

  await t.test("lastAlive returns surviving player", () => {
    const participants: MatchParticipant[] = [
      { playerId: "p1", username: "Alice", role: "player", status: "eliminated", score: 100, stackSize: 0 },
      { playerId: "p2", username: "Bob", role: "player", status: "eliminated", score: 50, stackSize: 0 },
      { playerId: "p3", username: "Carol", role: "player", status: "coding", score: 10, stackSize: 3 },
    ];

    const result = computeMatchEnd(participants, "lastAlive");

    assert.equal(result.endReason, "lastAlive");
    assert.equal(result.winnerPlayerId, "p3");
  });

  await t.test("tie-break by stackSize when scores equal", () => {
    const participants: MatchParticipant[] = [
      { playerId: "p1", username: "Alice", role: "player", status: "coding", score: 20, stackSize: 5 },
      { playerId: "p2", username: "Bob", role: "player", status: "coding", score: 20, stackSize: 2 },
    ];

    const result = computeMatchEnd(participants, "timeExpired");

    assert.equal(result.winnerPlayerId, "p2"); // Lower stackSize wins
    assert.equal(result.standings[0].playerId, "p2");
  });

  await t.test("excludes spectators from standings", () => {
    const participants: MatchParticipant[] = [
      { playerId: "p1", username: "Alice", role: "player", status: "coding", score: 20, stackSize: 2 },
      { playerId: "s1", username: "Spectator", role: "spectator", status: "lobby", score: 0, stackSize: 0 },
    ];

    const result = computeMatchEnd(participants, "timeExpired");

    assert.equal(result.standings.length, 1);
    assert.equal(result.standings[0].playerId, "p1");
  });
});

test("Should Match End Check", async (t) => {
  await t.test("returns false in lobby phase", () => {
    const result = shouldMatchEnd("lobby", undefined, 5, new Date());
    assert.equal(result.shouldEnd, false);
  });

  await t.test("returns false in ended phase", () => {
    const result = shouldMatchEnd("ended", undefined, 0, new Date());
    assert.equal(result.shouldEnd, false);
  });

  await t.test("returns true with lastAlive when 1 player left", () => {
    const result = shouldMatchEnd("main", "2025-12-31T23:59:59Z", 1, new Date("2025-01-01"));
    assert.equal(result.shouldEnd, true);
    assert.equal(result.reason, "lastAlive");
  });

  await t.test("returns true with lastAlive when 0 players left", () => {
    const result = shouldMatchEnd("main", "2025-12-31T23:59:59Z", 0, new Date("2025-01-01"));
    assert.equal(result.shouldEnd, true);
    assert.equal(result.reason, "lastAlive");
  });

  await t.test("returns true with timeExpired when past endAt", () => {
    const result = shouldMatchEnd("main", "2025-01-01T12:00:00Z", 5, new Date("2025-01-01T12:00:01Z"));
    assert.equal(result.shouldEnd, true);
    assert.equal(result.reason, "timeExpired");
  });

  await t.test("returns false when time not expired and multiple players", () => {
    const result = shouldMatchEnd("main", "2025-12-31T23:59:59Z", 5, new Date("2025-01-01"));
    assert.equal(result.shouldEnd, false);
  });
});

// ============================================================================
// Shop System Tests
// ============================================================================

test("Shop Purchase Validation", async (t) => {
  await t.test("allows purchase with sufficient score", () => {
    const result = canPurchaseItem("clearDebuff", 15, undefined, 1000);
    assert.equal(result.canPurchase, true);
  });

  await t.test("blocks purchase with insufficient score", () => {
    const result = canPurchaseItem("clearDebuff", 5, undefined, 1000);
    assert.equal(result.canPurchase, false);
    assert.equal(result.errorCode, "INSUFFICIENT_SCORE");
  });

  await t.test("blocks purchase when on cooldown", () => {
    const cooldownEndsAt = 5000;
    const result = canPurchaseItem("rateLimiter", 100, cooldownEndsAt, 3000);
    assert.equal(result.canPurchase, false);
    assert.equal(result.errorCode, "ITEM_ON_COOLDOWN");
    assert.equal(result.retryAfterMs, 2000);
  });

  await t.test("allows purchase when cooldown expired", () => {
    const cooldownEndsAt = 3000;
    const result = canPurchaseItem("rateLimiter", 100, cooldownEndsAt, 5000);
    assert.equal(result.canPurchase, true);
  });

  await t.test("rejects unknown item", () => {
    const result = canPurchaseItem("unknownItem" as any, 100, undefined, 1000);
    assert.equal(result.canPurchase, false);
    assert.equal(result.errorCode, "BAD_REQUEST");
  });

  await t.test("validates correct costs from catalog", () => {
    // clearDebuff costs 10
    assert.equal(canPurchaseItem("clearDebuff", 10, undefined, 1000).canPurchase, true);
    assert.equal(canPurchaseItem("clearDebuff", 9, undefined, 1000).canPurchase, false);

    // skipProblem costs 5 and can go negative (emergency escape)
    assert.equal(canPurchaseItem("skipProblem", 5, undefined, 1000).canPurchase, true);
    assert.equal(canPurchaseItem("skipProblem", 0, undefined, 1000).canPurchase, true); // Can go negative!
    assert.equal(canPurchaseItem("skipProblem", -10, undefined, 1000).canPurchase, true); // Even with negative score

    // hint costs 5
    assert.equal(canPurchaseItem("hint", 5, undefined, 1000).canPurchase, true);
    assert.equal(canPurchaseItem("hint", 4, undefined, 1000).canPurchase, false);
  });
});

// ============================================================================
// Problem Arrival Timing Tests
// ============================================================================

test("Problem Arrival Interval", async (t) => {
  await t.test("warmup phase has 90s base interval", () => {
    const result = calculateProblemArrivalInterval("warmup", false, false);
    assert.equal(result, 90000);
  });

  await t.test("main phase has 60s base interval", () => {
    const result = calculateProblemArrivalInterval("main", false, false);
    assert.equal(result, 60000);
  });

  await t.test("memoryLeak halves the interval", () => {
    const warmup = calculateProblemArrivalInterval("warmup", true, false);
    assert.equal(warmup, 45000); // 90 * 0.5

    const main = calculateProblemArrivalInterval("main", true, false);
    assert.equal(main, 30000); // 60 * 0.5
  });

  await t.test("rateLimiter doubles the interval", () => {
    const warmup = calculateProblemArrivalInterval("warmup", false, true);
    assert.equal(warmup, 180000); // 90 * 2

    const main = calculateProblemArrivalInterval("main", false, true);
    assert.equal(main, 120000); // 60 * 2
  });

  await t.test("memoryLeak and rateLimiter stack multiplicatively", () => {
    const warmup = calculateProblemArrivalInterval("warmup", true, true);
    assert.equal(warmup, 90000); // 90 * 0.5 * 2 = 90

    const main = calculateProblemArrivalInterval("main", true, true);
    assert.equal(main, 60000); // 60 * 0.5 * 2 = 60
  });
});

// ============================================================================
// Difficulty Weights Tests
// ============================================================================

test("Difficulty Weights", async (t) => {
  await t.test("beginner profile favors easy", () => {
    const weights = getDifficultyWeights("beginner");
    assert.equal(weights.easy, 70);
    assert.equal(weights.medium, 25);
    assert.equal(weights.hard, 5);
  });

  await t.test("moderate profile is balanced", () => {
    const weights = getDifficultyWeights("moderate");
    assert.equal(weights.easy, 40);
    assert.equal(weights.medium, 40);
    assert.equal(weights.hard, 20);
  });

  await t.test("competitive profile favors harder", () => {
    const weights = getDifficultyWeights("competitive");
    assert.equal(weights.easy, 20);
    assert.equal(weights.medium, 40);
    assert.equal(weights.hard, 40);
  });
});

// ============================================================================
// Stack Management Tests
// ============================================================================

test("Stack Overflow Check", async (t) => {
  await t.test("returns true when at limit", () => {
    assert.equal(wouldOverflow(10, 10), true);
  });

  await t.test("returns true when above limit", () => {
    assert.equal(wouldOverflow(11, 10), true);
  });

  await t.test("returns false when below limit", () => {
    assert.equal(wouldOverflow(9, 10), false);
  });

  await t.test("returns false when empty", () => {
    assert.equal(wouldOverflow(0, 10), false);
  });
});

// ============================================================================
// Bot Simulation Tests
// ============================================================================

test("Bot Solve Time", async (t) => {
  await t.test("easy difficulty range is 30-60s", () => {
    const min = calculateBotSolveTime("easy", 0);
    const max = calculateBotSolveTime("easy", 0.9999);

    assert.equal(min, 30000);
    assert.ok(max < 60000);
    assert.ok(max > 59000);
  });

  await t.test("medium difficulty range is 45-90s", () => {
    const min = calculateBotSolveTime("medium", 0);
    const max = calculateBotSolveTime("medium", 0.9999);

    assert.equal(min, 45000);
    assert.ok(max < 90000);
    assert.ok(max > 89000);
  });

  await t.test("hard difficulty range is 60-120s", () => {
    const min = calculateBotSolveTime("hard", 0);
    const max = calculateBotSolveTime("hard", 0.9999);

    assert.equal(min, 60000);
    assert.ok(max < 120000);
    assert.ok(max > 119000);
  });
});

test("Bot Submission Pass Rate", async (t) => {
  await t.test("passes when random > 0.2", () => {
    assert.equal(botSubmissionPasses(0.21), true);
    assert.equal(botSubmissionPasses(0.5), true);
    assert.equal(botSubmissionPasses(1), true);
  });

  await t.test("fails when random <= 0.2", () => {
    assert.equal(botSubmissionPasses(0), false);
    assert.equal(botSubmissionPasses(0.1), false);
    assert.equal(botSubmissionPasses(0.2), false);
  });

  await t.test("approximately 80% success rate", () => {
    // Not a statistical test, just verify the threshold
    let passes = 0;
    for (let i = 0; i < 100; i++) {
      if (botSubmissionPasses(i / 100)) passes++;
    }
    // With values 0.00 to 0.99, we expect 79 passes (0.21 to 0.99)
    assert.equal(passes, 79);
  });
});

// ============================================================================
// Integration-style Tests
// ============================================================================

test("Full Attack Scenario", async (t) => {
  await t.test("streak progression affects attack type", () => {
    // Simulate a player solving problems
    const attacks: string[] = [];

    // Easy problems with increasing streak
    for (let streak = 1; streak <= 9; streak++) {
      const attack = determineAttackType("easy", streak);
      attacks.push(attack);
    }

    // Streaks 1,2,4,5,7,8 should be garbageDrop
    // Streaks 3,6,9 should be memoryLeak
    assert.equal(attacks[0], "garbageDrop"); // streak 1
    assert.equal(attacks[1], "garbageDrop"); // streak 2
    assert.equal(attacks[2], "memoryLeak"); // streak 3
    assert.equal(attacks[3], "garbageDrop"); // streak 4
    assert.equal(attacks[4], "garbageDrop"); // streak 5
    assert.equal(attacks[5], "memoryLeak"); // streak 6
    assert.equal(attacks[6], "garbageDrop"); // streak 7
    assert.equal(attacks[7], "garbageDrop"); // streak 8
    assert.equal(attacks[8], "memoryLeak"); // streak 9
  });
});

test("Full Match Scenario", async (t) => {
  await t.test("match ends correctly with multiple conditions", () => {
    // Scenario: 2 players, one gets eliminated, time expires
    const participants: MatchParticipant[] = [
      { playerId: "p1", username: "Alice", role: "player", status: "coding", score: 50, stackSize: 3 },
      { playerId: "p2", username: "Bob", role: "player", status: "eliminated", score: 40, stackSize: 11 },
    ];

    // Check: only 1 alive, should trigger lastAlive
    const check1 = shouldMatchEnd("main", "2025-12-31T23:59:59Z", 1, new Date("2025-01-01"));
    assert.equal(check1.shouldEnd, true);
    assert.equal(check1.reason, "lastAlive");

    // Compute final result
    const result = computeMatchEnd(participants, "lastAlive");
    assert.equal(result.winnerPlayerId, "p1");
    assert.equal(result.standings[0].playerId, "p1");
    assert.equal(result.standings[1].playerId, "p2");
  });
});
