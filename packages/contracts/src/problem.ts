import { z } from "zod";

// ============================================================================
// Problem Types
// ============================================================================

export const DifficultySchema = z.enum(["easy", "medium", "hard"]);
export type Difficulty = z.infer<typeof DifficultySchema>;

export const ProblemTypeSchema = z.enum(["code", "mcq"]).default("code");
export type ProblemType = z.infer<typeof ProblemTypeSchema>;

export const MCQOptionSchema = z.object({
  id: z.string(),
  text: z.string(),
});
export type MCQOption = z.infer<typeof MCQOptionSchema>;

export const TestCaseSchema = z.object({
  input: z.unknown(),
  output: z.unknown(),
});
export type TestCase = z.infer<typeof TestCaseSchema>;

/**
 * Base fields common to all problem types
 */
const ProblemBaseSchema = z.object({
  problemId: z.string(),
  title: z.string(),
  prompt: z.string(),
  difficulty: DifficultySchema,
  timeLimitMs: z.number().int().min(100).max(30000),
  hintCount: z.number().int().min(0).optional(),
  isGarbage: z.boolean().optional(),
});

/**
 * Code problem specific fields
 */
const CodeProblemFields = z.object({
  problemType: z.literal("code").default("code"),
  functionName: z.string(),
  signature: z.string(),
  starterCode: z.string(),
  publicTests: z.array(TestCaseSchema),
});

/**
 * MCQ problem specific fields
 */
const MCQProblemFields = z.object({
  problemType: z.literal("mcq"),
  options: z.array(MCQOptionSchema),
});

/**
 * Problem as seen by the client
 */
export const ProblemClientViewSchema = z.discriminatedUnion("problemType", [
  ProblemBaseSchema.merge(CodeProblemFields),
  ProblemBaseSchema.merge(MCQProblemFields),
]);
export type ProblemClientView = z.infer<typeof ProblemClientViewSchema>;

/**
 * Full problem definition (server-side)
 */
export const ProblemFullSchema = z.discriminatedUnion("problemType", [
  ProblemBaseSchema.merge(CodeProblemFields).extend({
    hiddenTests: z.array(TestCaseSchema),
    hints: z.array(z.string()).optional(),
    solutionSketch: z.string().optional(),
  }),
  ProblemBaseSchema.merge(MCQProblemFields).extend({
    // MCQs might not have hidden tests in the same way, or might have just correct answer
    // For now keeping structure similar but optional/specific
    hiddenTests: z.array(TestCaseSchema).optional(), 
    hints: z.array(z.string()).optional(),
    correctAnswer: z.string(),
  }),
]);
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
