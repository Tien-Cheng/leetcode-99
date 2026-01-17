import type {
  Difficulty,
  DifficultyProfile,
  ProblemClientView,
  ProblemFull,
  ProblemSummary,
} from "@leet99/contracts";

import problemsData from "./problems.json";

// ============================================================================
// Problem Bank
// ============================================================================

const PROBLEMS: ProblemFull[] = problemsData as ProblemFull[];

/**
 * Get all problems, optionally filtered by difficulty and garbage status
 */
export function getAllProblems(options?: {
  difficulty?: Difficulty;
  isGarbage?: boolean;
}): ProblemFull[] {
  let filtered = PROBLEMS;

  if (options?.difficulty !== undefined) {
    filtered = filtered.filter((p) => p.difficulty === options.difficulty);
  }

  if (options?.isGarbage !== undefined) {
    filtered = filtered.filter((p) => (p.isGarbage ?? false) === options.isGarbage);
  }

  return filtered;
}

/**
 * Convert full problem to client view (removes hidden tests)
 */
export function toClientView(problem: ProblemFull): ProblemClientView {
  const { hiddenTests: _hiddenTests, solutionSketch: _solutionSketch, ...clientView } = problem;
  return {
    ...clientView,
    hintCount: problem.hints?.length ?? 0,
  };
}

/**
 * Convert full problem to summary (for stack display)
 */
export function toSummary(problem: ProblemFull): ProblemSummary {
  return {
    problemId: problem.problemId,
    title: problem.title,
    difficulty: problem.difficulty,
    isGarbage: problem.isGarbage,
  };
}

/**
 * Get problem by ID (full version with hidden tests)
 */
export function getProblemById(problemId: string): ProblemFull | undefined {
  return PROBLEMS.find((p) => p.problemId === problemId);
}

/**
 * Get problem by ID (client view, no hidden tests)
 */
export function getProblemClientView(problemId: string): ProblemClientView | undefined {
  const problem = getProblemById(problemId);
  return problem ? toClientView(problem) : undefined;
}

// ============================================================================
// Problem Sampler
// ============================================================================

/**
 * Per-player problem sampling state
 */
export interface PlayerProblemState {
  seenProblemIds: Set<string>;
  availableProblemIds: Set<string>;
}

/**
 * Initialize problem state for a player
 */
export function initPlayerProblemState(): PlayerProblemState {
  return {
    seenProblemIds: new Set(),
    availableProblemIds: new Set(PROBLEMS.map((p) => p.problemId)),
  };
}

/**
 * Get difficulty weights based on profile
 */
function getDifficultyWeights(profile: DifficultyProfile): Record<Difficulty, number> {
  switch (profile) {
    case "beginner":
      return { easy: 0.7, medium: 0.3, hard: 0.0 };
    case "moderate":
      return { easy: 0.4, medium: 0.5, hard: 0.1 };
    case "competitive":
      return { easy: 0.2, medium: 0.5, hard: 0.3 };
    default:
      return { easy: 0.4, medium: 0.5, hard: 0.1 };
  }
}

/**
 * Sample a problem for a player based on difficulty profile
 * Avoids repeats until bank is exhausted, then allows repeats
 */
export function sampleProblem(
  playerState: PlayerProblemState,
  difficultyProfile: DifficultyProfile,
  allowGarbage: boolean = true,
): ProblemFull | null {
  const weights = getDifficultyWeights(difficultyProfile);
  const allProblems = getAllProblems({ isGarbage: allowGarbage ? undefined : false });

  // If we've seen all available problems, reset and allow repeats
  if (playerState.availableProblemIds.size === 0) {
    playerState.seenProblemIds.clear();
    playerState.availableProblemIds = new Set(allProblems.map((p) => p.problemId));
  }

  // Filter to unseen problems
  const unseenProblems = allProblems.filter(
    (p) => playerState.availableProblemIds.has(p.problemId),
  );

  if (unseenProblems.length === 0) {
    // Fallback: use all problems if somehow we have none
    const fallback = allProblems;
    if (fallback.length === 0) {
      return null;
    }

    // Weighted random selection
    const candidates: ProblemFull[] = [];
    for (const problem of fallback) {
      const weight = weights[problem.difficulty];
      for (let i = 0; i < Math.ceil(weight * 100); i++) {
        candidates.push(problem);
      }
    }

    if (candidates.length === 0) {
      return null;
    }

    const selected = candidates[Math.floor(Math.random() * candidates.length)];
    if (!selected) {
      return null;
    }

    playerState.seenProblemIds.add(selected.problemId);
    playerState.availableProblemIds.delete(selected.problemId);
    return selected;
  }

  // Weighted random selection from unseen problems
  const candidates: ProblemFull[] = [];
  for (const problem of unseenProblems) {
    const weight = weights[problem.difficulty];
    for (let i = 0; i < Math.ceil(weight * 100); i++) {
      candidates.push(problem);
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  const selected = candidates[Math.floor(Math.random() * candidates.length)];
  if (!selected) {
    return null;
  }

  playerState.seenProblemIds.add(selected.problemId);
  playerState.availableProblemIds.delete(selected.problemId);
  return selected;
}

/**
 * Sample a garbage problem (always available, doesn't affect seenProblemIds)
 */
export function sampleGarbageProblem(): ProblemFull | null {
  const garbage = getAllProblems({ isGarbage: true });
  if (garbage.length === 0) {
    return null;
  }
  const selected = garbage[Math.floor(Math.random() * garbage.length)];
  if (!selected) {
    return null;
  }
  return selected;
}
