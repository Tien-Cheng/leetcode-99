import type {
  ProblemFull,
  JudgeResult,
  PublicTestResult,
  TestCase,
} from "@leet99/contracts";
import type { JudgeConfig, LogContext, ExecuteTestsResult } from "./types.js";
import {
  PYTHON3_LANGUAGE_ID,
  STATUS_ACCEPTED,
  STATUS_WRONG_ANSWER,
  STATUS_TIME_LIMIT_EXCEEDED,
  STATUS_COMPILATION_ERROR,
  STATUS_RUNTIME_ERROR,
  DEFAULT_MEMORY_LIMIT_KB,
} from "./constants.js";
import { JudgeError } from "./errors.js";
import { log } from "./logger.js";
import { getCacheKey, getCachedResult, setCachedResult } from "./cache.js";
import { createSubmission, getSubmissionResult } from "./judge0-client.js";
import { buildTestHarness, parseTestOutput } from "./test-harness.js";

// ============================================================================
// Internal Test Execution
// ============================================================================

/**
 * Execute code against test cases using Judge0
 * @throws {JudgeError} If execution fails
 */
async function executeTests(
  problem: ProblemFull,
  code: string,
  config: JudgeConfig,
  testCases: TestCase[],
  context?: LogContext,
): Promise<ExecuteTestsResult> {
  const languageId = config.pythonLanguageId ?? PYTHON3_LANGUAGE_ID;
  const harness = buildTestHarness(
    code,
    problem.functionName,
    testCases,
    languageId,
  );

  const submission = {
    source_code: harness,
    language_id: languageId,
    cpu_time_limit: Math.ceil(problem.timeLimitMs / 1000), // Convert ms to seconds
    memory_limit: DEFAULT_MEMORY_LIMIT_KB,
  };

  const token = await createSubmission(config, submission, context);
  const result = await getSubmissionResult(
    config,
    token,
    problem.timeLimitMs + 5000, // Add 5s buffer for API overhead
    context,
  );

  const runtimeMs = result.time
    ? Math.round(parseFloat(result.time) * 1000)
    : undefined;

  // Handle compilation errors
  if (result.status?.id === STATUS_COMPILATION_ERROR) {
    const compileError =
      result.compile_output || result.message || "Compilation error";
    return {
      publicTests: testCases.map((_, index) => ({
        index,
        passed: false,
        error: compileError,
        stderr: compileError,
      })),
      runtimeMs,
      stderr: compileError,
    };
  }

  // Handle runtime errors
  if (result.status?.id === STATUS_RUNTIME_ERROR) {
    const runtimeError = result.stderr || result.message || "Runtime error";
    return {
      publicTests: testCases.map((_, index) => ({
        index,
        passed: false,
        error: runtimeError,
        stderr: runtimeError,
      })),
      runtimeMs,
      stderr: runtimeError,
    };
  }

  // Handle time limit exceeded
  if (result.status?.id === STATUS_TIME_LIMIT_EXCEEDED) {
    return {
      publicTests: testCases.map((_, index) => ({
        index,
        passed: false,
        error: "Time limit exceeded",
      })),
      runtimeMs,
    };
  }

  // Parse test results from stdout
  // Note: We determine acceptance by parsing test harness output, not by STATUS_ACCEPTED,
  // because our harness runs multiple test cases. STATUS_ACCEPTED only means execution succeeded.
  const stdout = result.stdout || "";
  const parsedResults = parseTestOutput(stdout);

  // Log if execution succeeded but we couldn't parse results (shouldn't happen normally)
  if (result.status?.id === STATUS_ACCEPTED && parsedResults.length === 0) {
    log("warn", "Judge0 returned Accepted but no test results parsed", {
      ...context,
      stdout: stdout.slice(0, 200), // Log first 200 chars
    });
  }

  // Ensure we have results for all test cases
  const publicTests: PublicTestResult[] = testCases.map((_, index) => {
    const parsed = parsedResults.find((r) => r.index === index);
    if (parsed) {
      return {
        ...parsed,
        stdout: parsed.passed ? stdout : undefined,
        stderr: result.stderr || undefined,
      };
    }
    // If no parsed result, check if stdout indicates failure
    if (result.status?.id === STATUS_WRONG_ANSWER) {
      return {
        index,
        passed: false,
        error: "Wrong answer",
        stdout,
        stderr: result.stderr || undefined,
      };
    }
    // Default to failed if we can't parse
    return {
      index,
      passed: false,
      error: "Test execution failed",
      stdout,
      stderr: result.stderr || undefined,
    };
  });

  return {
    publicTests,
    runtimeMs,
    stderr: result.stderr || undefined,
  };
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Run public tests only (for RUN_CODE).
 * Does not affect score or trigger attacks.
 *
 * @param problem - Full problem definition
 * @param code - User's code to test
 * @param config - Judge0 configuration
 * @returns Judge result with public test outcomes
 * @throws {JudgeError} If execution fails
 */
export async function runPublicTests(
  problem: ProblemFull,
  code: string,
  config: JudgeConfig,
): Promise<JudgeResult> {
  const context: LogContext = { problemId: problem.problemId };
  log("info", "Running public tests", {
    ...context,
    testCount: problem.publicTests.length,
  });

  // Check cache
  const cacheKey = getCacheKey(problem.problemId, code);
  const cached = getCachedResult(cacheKey);
  if (cached && cached.kind === "run") {
    log("info", "Cache hit for public tests", context);
    return cached;
  }

  try {
    const { publicTests, runtimeMs } = await executeTests(
      problem,
      code,
      config,
      problem.publicTests,
      context,
    );

    const allPassed = publicTests.every((t) => t.passed);

    const result: JudgeResult = {
      kind: "run",
      problemId: problem.problemId,
      passed: allPassed,
      publicTests,
      runtimeMs,
    };

    log("info", "Public tests completed", {
      ...context,
      passed: allPassed,
      runtimeMs,
      passedCount: publicTests.filter((t) => t.passed).length,
      totalCount: publicTests.length,
    });

    // Cache successful runs (but not failures, to allow retries)
    if (allPassed) {
      setCachedResult(cacheKey, result);
    }

    return result;
  } catch (error) {
    if (error instanceof JudgeError) {
      throw error;
    }
    log("error", "Failed to run public tests", {
      ...context,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new JudgeError(
      "INTERNAL_ERROR",
      `Failed to run public tests: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Run all tests (public + hidden) for SUBMIT_CODE.
 * This is the authoritative result that affects scoring.
 *
 * Hidden test failures are opaque - only returns pass/fail status without revealing test details.
 *
 * @param problem - Full problem definition (including hidden tests)
 * @param code - User's code to test
 * @param config - Judge0 configuration
 * @returns Judge result with public test details and hidden test pass/fail status
 * @throws {JudgeError} If execution fails
 */
export async function runAllTests(
  problem: ProblemFull,
  code: string,
  config: JudgeConfig,
): Promise<JudgeResult> {
  const context: LogContext = { problemId: problem.problemId };
  log("info", "Running all tests (public + hidden)", {
    ...context,
    publicCount: problem.publicTests.length,
    hiddenCount: problem.hiddenTests.length,
  });

  // Check cache
  const cacheKey = getCacheKey(problem.problemId, code);
  const cached = getCachedResult(cacheKey);
  if (cached && cached.kind === "submit") {
    log("info", "Cache hit for all tests", context);
    return cached;
  }

  try {
    // Run public tests first (for detailed feedback)
    const publicResult = await executeTests(
      problem,
      code,
      config,
      problem.publicTests,
      { ...context, phase: "public" },
    );

    // Run hidden tests separately (keep details server-side)
    const hiddenResult = await executeTests(
      problem,
      code,
      config,
      problem.hiddenTests,
      { ...context, phase: "hidden" },
    );

    const publicTestsPassed = publicResult.publicTests.every((t) => t.passed);
    const hiddenTestsPassed = hiddenResult.publicTests.every((t) => t.passed);
    const allPassed = publicTestsPassed && hiddenTestsPassed;

    const result: JudgeResult = {
      kind: "submit",
      problemId: problem.problemId,
      passed: allPassed,
      publicTests: publicResult.publicTests,
      runtimeMs: publicResult.runtimeMs || hiddenResult.runtimeMs,
      hiddenTestsPassed,
      hiddenFailureMessage: hiddenTestsPassed
        ? undefined
        : "Failed hidden tests",
    };

    log("info", "All tests completed", {
      ...context,
      passed: allPassed,
      publicPassed: publicTestsPassed,
      hiddenPassed: hiddenTestsPassed,
      runtimeMs: result.runtimeMs,
    });

    // Cache successful submissions
    if (allPassed) {
      setCachedResult(cacheKey, result);
    }

    return result;
  } catch (error) {
    if (error instanceof JudgeError) {
      throw error;
    }
    log("error", "Failed to run all tests", {
      ...context,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new JudgeError(
      "INTERNAL_ERROR",
      `Failed to run all tests: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}
