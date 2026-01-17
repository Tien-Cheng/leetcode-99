import { z } from "zod";

// ============================================================================
// Problem Types
// ============================================================================

export const DifficultySchema = z.enum(["easy", "medium", "hard"]);
export type Difficulty = z.infer<typeof DifficultySchema>;

export const TestCaseSchema = z.object({
  input: z.unknown(),
  output: z.unknown(),
});
export type TestCase = z.infer<typeof TestCaseSchema>;

/**
 * Problem as seen by the client (no hidden tests)
 */
export const ProblemClientViewSchema = z.object({
  problemId: z.string(),
  title: z.string(),
  prompt: z.string(),
  functionName: z.string(),
  signature: z.string(),
  starterCode: z.string(),
  publicTests: z.array(TestCaseSchema),
  difficulty: DifficultySchema,
  timeLimitMs: z.number().int().min(100).max(30000),
  hintCount: z.number().int().min(0).optional(),
  isGarbage: z.boolean().optional(),
});
export type ProblemClientView = z.infer<typeof ProblemClientViewSchema>;

/**
 * Full problem definition (server-side, includes hidden tests)
 */
export const ProblemFullSchema = ProblemClientViewSchema.extend({
  hiddenTests: z.array(TestCaseSchema),
  hints: z.array(z.string()).optional(),
  solutionSketch: z.string().optional(),
});
export type ProblemFull = z.infer<typeof ProblemFullSchema>;

/**
 * Problem summary for stack display
 */
export const ProblemSummarySchema = z.object({
  problemId: z.string(),
  title: z.string(),
  difficulty: DifficultySchema,
  isGarbage: z.boolean().optional(),
});
export type ProblemSummary = z.infer<typeof ProblemSummarySchema>;

// ============================================================================
// Judge Results
// ============================================================================

export const PublicTestResultSchema = z.object({
  index: z.number().int().min(0),
  passed: z.boolean(),
  expected: z.unknown().optional(),
  received: z.unknown().optional(),
  stdout: z.string().optional(),
  stderr: z.string().optional(),
  error: z.string().optional(),
});
export type PublicTestResult = z.infer<typeof PublicTestResultSchema>;

export const JudgeResultKindSchema = z.enum(["run", "submit"]);
export type JudgeResultKind = z.infer<typeof JudgeResultKindSchema>;

export const JudgeResultSchema = z.object({
  kind: JudgeResultKindSchema,
  problemId: z.string(),
  passed: z.boolean(),
  publicTests: z.array(PublicTestResultSchema),
  runtimeMs: z.number().optional(),
  hiddenTestsPassed: z.boolean().optional(),
  hiddenFailureMessage: z.string().optional(),
});
export type JudgeResult = z.infer<typeof JudgeResultSchema>;

// ============================================================================
// Player Private State
// ============================================================================

export const PlayerPrivateStateSchema = z.object({
  currentProblem: ProblemClientViewSchema.nullable(),
  queued: z.array(ProblemSummarySchema),
  code: z.string(),
  codeVersion: z.number().int().min(1),
  revealedHints: z.array(z.string()),
  shopCooldowns: z.record(z.string(), z.number()).optional(),
});
export type PlayerPrivateState = z.infer<typeof PlayerPrivateStateSchema>;

// ============================================================================
// Spectate View
// ============================================================================

export const SpectateViewSchema = z.object({
  playerId: z.string(),
  username: z.string(),
  status: z.enum(["lobby", "coding", "error", "underAttack", "eliminated"]),
  score: z.number().int(),
  streak: z.number().int(),
  targetingMode: z.enum(["random", "attackers", "topScore", "nearDeath", "rankAbove"]),
  stackSize: z.number().int(),
  activeDebuff: z
    .object({
      type: z.enum(["ddos", "flashbang", "vimLock", "memoryLeak"]),
      endsAt: z.string().datetime(),
    })
    .nullable()
    .optional(),
  activeBuff: z
    .object({
      type: z.enum(["rateLimiter"]),
      endsAt: z.string().datetime(),
    })
    .nullable()
    .optional(),
  currentProblem: ProblemClientViewSchema.nullable(),
  queued: z.array(ProblemSummarySchema),
  code: z.string(),
  codeVersion: z.number().int(),
  revealedHints: z.array(z.string()),
});
export type SpectateView = z.infer<typeof SpectateViewSchema>;
