import { createHash } from "node:crypto";
import type {
  ProblemFull,
  JudgeResult,
  PublicTestResult,
  TestCase,
} from "@leet99/contracts";

/**
 * @leet99/judge - Judge0 adapter for code execution
 *
 * Provides functions for running code against test cases.
 * - runPublicTests: Runs public tests only (for RUN_CODE)
 * - runAllTests: Runs public + hidden tests (for SUBMIT_CODE)
 *
 * Security: This module handles remote code execution via Judge0.
 * - Never expose Judge0 credentials to clients
 * - Always validate input before execution
 * - Enforce strict timeouts and resource limits
 */

// ============================================================================
// Logging
// ============================================================================

interface LogContext {
  problemId?: string;
  requestId?: string;
  playerId?: string;
  [key: string]: unknown;
}

/**
 * Server-side logging helper (only logs on server)
 * Includes context like problemId, requestId, playerId when relevant
 */
function log(level: "info" | "warn" | "error", message: string, context?: LogContext): void {
  // Only log on server-side (check if we're in a browser environment)
  if (typeof globalThis !== "undefined" && "window" in globalThis) return;

  const timestamp = new Date().toISOString();
  const contextStr = context ? ` ${JSON.stringify(context)}` : "";
  console[level](`[${timestamp}] [judge] ${message}${contextStr}`);
}

// ============================================================================
// Judge0 Configuration
// ============================================================================

/**
 * Judge0 language IDs for Python
 * - Python 3.8.1: 71
 * - Python 3.10.0: 92 (default)
 * - Python 3.13.2: Not available in Judge0 CE/Extra CE (requires self-hosted instance)
 *
 * We default to 92 (Python 3.10.0) for better language features and type hint support.
 * For Python 3.8.1 compatibility, set pythonLanguageId to 71 in config.
 */
const PYTHON3_LANGUAGE_ID = 92; // Python 3.10.0 (default)

/**
 * Judge0 status IDs
 * See: https://ce.judge0.com/#statuses-and-languages-status-get
 *
 * Note: We determine acceptance by parsing test harness output, not by checking
 * STATUS_ACCEPTED, because our harness runs multiple test cases and reports
 * individual pass/fail results. Judge0's status only indicates execution success.
 */
const STATUS_ACCEPTED = 3; // Execution succeeded (but individual tests may still fail)
const STATUS_WRONG_ANSWER = 4;
const STATUS_TIME_LIMIT_EXCEEDED = 5;
const STATUS_COMPILATION_ERROR = 6;
const STATUS_RUNTIME_ERROR = 7;

/**
 * Configuration for Judge0 execution service
 */
export interface JudgeConfig {
  /** Judge0 API base URL (e.g., https://judge0-ce.p.rapidapi.com) */
  judge0Url: string;
  /** Judge0 API key (RapidAPI key or custom API key for self-hosted) */
  judge0ApiKey: string;
  /** RapidAPI host header (e.g., judge0-ce.p.rapidapi.com) - only needed for RapidAPI */
  rapidApiHost?: string;
  /**
   * Python language ID (default: 92 for Python 3.10.0)
   * For Python 3.8.1, set to 71. For Python 3.13.2 or other versions, use a self-hosted Judge0 instance
   * and set this to the appropriate language ID
   */
  pythonLanguageId?: number;
}

/**
 * Query Judge0 for available languages
 *
 * Useful for:
 * - Finding the language ID for Python 3.13.2 or other specific versions
 * - Discovering what languages are supported by your Judge0 instance
 * - Checking if a language is archived
 *
 * @param config - Judge0 configuration
 * @returns Array of available languages with their IDs, names, and archived status
 * @throws {JudgeError} If the request fails
 *
 * @example
 * ```ts
 * const languages = await getAvailableLanguages(config);
 * const python313 = languages.find(l => l.name.includes("Python 3.13"));
 * if (python313) {
 *   config.pythonLanguageId = python313.id;
 * }
 * ```
 */
export async function getAvailableLanguages(
  config: JudgeConfig,
): Promise<Array<{ id: number; name: string; isArchived: boolean }>> {
  const url = new URL("/languages", config.judge0Url);

  const headers: Record<string, string> = {
    "X-RapidAPI-Key": config.judge0ApiKey,
  };

  if (config.rapidApiHost) {
    headers["X-RapidAPI-Host"] = config.rapidApiHost;
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    throw new JudgeError(
      "INTERNAL_ERROR",
      `Failed to fetch languages: ${response.status} ${response.statusText}`,
    );
  }

  const languages = (await response.json()) as Array<{
    id: number;
    name: string;
    is_archived: boolean;
  }>;

  return languages.map((lang) => ({
    id: lang.id,
    name: lang.name,
    isArchived: lang.is_archived,
  }));
}

// ============================================================================
// Judge0 API Types (internal)
// ============================================================================

/**
 * Judge0 submission request payload
 * See: https://ce.judge0.com/#submissions-submission-post
 */
interface Judge0Submission {
  /** Source code to execute */
  source_code: string;
  /** Language ID (e.g., 92 for Python 3.10.0) */
  language_id: number;
  /** Standard input (optional) */
  stdin?: string;
  /** Expected output for validation (optional) */
  expected_output?: string;
  /** CPU time limit in seconds (default: 5) */
  cpu_time_limit?: number;
  /** Memory limit in kilobytes (default: 128 MB = 131,072 KB) */
  memory_limit?: number;
}

/**
 * Judge0 API response
 * See: https://ce.judge0.com/#submissions-submission-get
 */
interface Judge0Response {
  /** Submission token (returned on POST) */
  token?: string;
  /** Execution status */
  status?: {
    /** Status ID (1=In Queue, 2=Processing, 3=Accepted, etc.) */
    id: number;
    /** Human-readable status description */
    description: string;
  };
  /** Standard output from execution */
  stdout?: string | null;
  /** Standard error from execution */
  stderr?: string | null;
  /** Compiler output (for compilation errors) */
  compile_output?: string | null;
  /** Additional message (for errors) */
  message?: string | null;
  /** Execution time in seconds (as string) */
  time?: string | null;
  /** Memory usage in kilobytes */
  memory?: number | null;
}

// ============================================================================
// Cache Management
// ============================================================================

// Simple in-memory cache (30s TTL)
interface CacheEntry {
  result: JudgeResult;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30_000; // 30 seconds
const CACHE_CLEANUP_INTERVAL_MS = 60_000; // Clean up every 60 seconds

// Automatic cache cleanup timer (only runs on server)
let cacheCleanupTimer: NodeJS.Timeout | null = null;

/**
 * Start automatic cache cleanup (called automatically on first cache use)
 */
function startCacheCleanup(): void {
  // Only run on server-side (check if we're in a browser environment)
  if (typeof globalThis !== "undefined" && "window" in globalThis) return;

  if (cacheCleanupTimer) return; // Already started

  log("info", "Starting automatic cache cleanup", { intervalMs: CACHE_CLEANUP_INTERVAL_MS });

  cacheCleanupTimer = setInterval(() => {
    const removed = cleanupCache();
    if (removed > 0) {
      log("info", "Cache cleanup completed", { entriesRemoved: removed, entriesRemaining: cache.size });
    }
  }, CACHE_CLEANUP_INTERVAL_MS);

  // Don't prevent process exit
  if (cacheCleanupTimer.unref) {
    cacheCleanupTimer.unref();
  }
}

/**
 * Stop automatic cache cleanup (useful for testing or shutdown)
 */
export function stopCacheCleanup(): void {
  if (cacheCleanupTimer) {
    clearInterval(cacheCleanupTimer);
    cacheCleanupTimer = null;
    log("info", "Stopped automatic cache cleanup");
  }
}

/**
 * Generate cache key from problemId and code hash
 */
function getCacheKey(problemId: string, code: string): string {
  const hash = createHash("sha256").update(code).digest("hex").slice(0, 16);
  return `${problemId}:${hash}`;
}

/**
 * Check cache for existing result
 */
function getCachedResult(key: string): JudgeResult | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.result;
}

/**
 * Store result in cache
 * Automatically starts cache cleanup timer on first use
 */
function setCachedResult(key: string, result: JudgeResult): void {
  cache.set(key, {
    result,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  // Start automatic cleanup on first cache entry
  if (cache.size === 1) {
    startCacheCleanup();
  }
}

/**
 * Clean up expired cache entries
 *
 * This function is called automatically every 60 seconds when the cache is in use.
 * You can also call it manually if needed (e.g., before process shutdown).
 *
 * @returns Number of entries removed
 */
export function cleanupCache(): number {
  const now = Date.now();
  let removed = 0;
  for (const [key, entry] of cache.entries()) {
    if (now > entry.expiresAt) {
      cache.delete(key);
      removed++;
    }
  }
  return removed;
}

/**
 * Create a submission in Judge0
 * @throws {JudgeError} If submission creation fails
 */
async function createSubmission(
  config: JudgeConfig,
  submission: Judge0Submission,
  context?: LogContext,
): Promise<string> {
  const url = new URL("/submissions", config.judge0Url);
  url.searchParams.set("base64_encoded", "false");
  url.searchParams.set("wait", "false"); // Poll for results

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-RapidAPI-Key": config.judge0ApiKey,
  };

  if (config.rapidApiHost) {
    headers["X-RapidAPI-Host"] = config.rapidApiHost;
  }

  log("info", "Creating Judge0 submission", {
    ...context,
    languageId: submission.language_id,
    timeLimitSec: submission.cpu_time_limit,
  });

  try {
    const response = await fetch(url.toString(), {
      method: "POST",
      headers,
      body: JSON.stringify(submission),
    });

    if (!response.ok) {
      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After");
        const retryAfterMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : undefined;
        log("warn", "Rate limit exceeded", { ...context, retryAfterMs });
        throw new JudgeError(
          "JUDGE_UNAVAILABLE",
          "Rate limit exceeded",
          retryAfterMs,
        );
      }
      if (response.status >= 500) {
        log("error", "Judge0 service unavailable", { ...context, status: response.status });
        throw new JudgeError(
          "JUDGE_UNAVAILABLE",
          "Judge0 service unavailable",
        );
      }
      const errorText = await response.text().catch(() => "Unknown error");
      log("error", "Judge0 API error", { ...context, status: response.status, error: errorText });
      throw new JudgeError(
        "INTERNAL_ERROR",
        `Judge0 API error: ${response.status}`,
      );
    }

    const data = (await response.json()) as Judge0Response;
    if (!data.token) {
      log("error", "No token returned from Judge0", context);
      throw new JudgeError("INTERNAL_ERROR", "No token returned from Judge0");
    }

    log("info", "Judge0 submission created", { ...context, token: data.token });
    return data.token;
  } catch (error) {
    if (error instanceof JudgeError) {
      throw error;
    }
    log("error", "Failed to create submission", { ...context, error: error instanceof Error ? error.message : String(error) });
    throw new JudgeError(
      "INTERNAL_ERROR",
      `Failed to create submission: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Poll for submission result
 * @throws {JudgeError} If polling fails or times out
 */
async function getSubmissionResult(
  config: JudgeConfig,
  token: string,
  maxWaitMs: number,
  context?: LogContext,
): Promise<Judge0Response> {
  const url = new URL(`/submissions/${token}`, config.judge0Url);
  url.searchParams.set("base64_encoded", "false");
  url.searchParams.set(
    "fields",
    "status,stdout,stderr,compile_output,message,time,memory",
  );

  const headers: Record<string, string> = {
    "X-RapidAPI-Key": config.judge0ApiKey,
  };

  if (config.rapidApiHost) {
    headers["X-RapidAPI-Host"] = config.rapidApiHost;
  }

  const startTime = Date.now();
  const pollInterval = 500; // Poll every 500ms
  const maxPolls = Math.ceil(maxWaitMs / pollInterval);

  log("info", "Polling for submission result", { ...context, token, maxWaitMs });

  for (let i = 0; i < maxPolls; i++) {
    try {
      const response = await fetch(url.toString(), {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        if (response.status === 429) {
          const retryAfter = response.headers.get("Retry-After");
          const retryAfterMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : undefined;
          log("warn", "Rate limit exceeded while polling", { ...context, token, retryAfterMs });
          throw new JudgeError(
            "JUDGE_UNAVAILABLE",
            "Rate limit exceeded",
            retryAfterMs,
          );
        }
        if (response.status >= 500) {
          log("error", "Judge0 service unavailable while polling", { ...context, token, status: response.status });
          throw new JudgeError(
            "JUDGE_UNAVAILABLE",
            "Judge0 service unavailable",
          );
        }
        const errorText = await response.text().catch(() => "Unknown error");
        log("error", "Judge0 API error while polling", { ...context, token, status: response.status, error: errorText });
        throw new JudgeError(
          "INTERNAL_ERROR",
          `Judge0 API error: ${response.status}`,
        );
      }

      const data = (await response.json()) as Judge0Response;

      // Status 1 = In Queue, Status 2 = Processing
      if (data.status && data.status.id > 2) {
        log("info", "Submission completed", {
          ...context,
          token,
          statusId: data.status.id,
          statusDescription: data.status.description,
          elapsedMs: Date.now() - startTime,
        });
        return data; // Completed (success or error)
      }

      // Check timeout
      if (Date.now() - startTime >= maxWaitMs) {
        log("error", "Submission timeout", { ...context, token, maxWaitMs, elapsedMs: Date.now() - startTime });
        throw new JudgeError(
          "JUDGE_UNAVAILABLE",
          "Submission timeout - Judge0 did not respond in time",
        );
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    } catch (error) {
      if (error instanceof JudgeError) {
        throw error;
      }
      log("error", "Failed to poll submission", { ...context, token, error: error instanceof Error ? error.message : String(error) });
      throw new JudgeError(
        "INTERNAL_ERROR",
        `Failed to poll submission: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  log("error", "Exceeded max poll attempts", { ...context, token, maxPolls });
  throw new JudgeError(
    "JUDGE_UNAVAILABLE",
    "Submission timeout - exceeded max poll attempts",
  );
}

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
): Promise<{
  publicTests: PublicTestResult[];
  runtimeMs?: number;
  stderr?: string;
}> {
  const languageId = config.pythonLanguageId ?? PYTHON3_LANGUAGE_ID;
  const harness = buildTestHarness(
    code,
    problem.functionName,
    testCases,
    languageId,
  );

  const submission: Judge0Submission = {
    source_code: harness,
    language_id: languageId,
    cpu_time_limit: Math.ceil(problem.timeLimitMs / 1000), // Convert ms to seconds
    memory_limit: 128 * 1024, // 128 MB in kilobytes (128 * 1024 = 131,072 KB)
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
    const compileError = result.compile_output || result.message || "Compilation error";
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
  const publicTests: PublicTestResult[] = testCases.map((test, index) => {
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

/**
 * Convert Python 3.9+ type hints to Python 3.8 compatible syntax if needed.
 * Only converts if using Python 3.8.1 (language ID 71).
 *
 * Converts:
 * - list[int] -> List[int]
 * - dict[str, int] -> Dict[str, int]
 * - tuple[int, str] -> Tuple[int, str]
 * - set[int] -> Set[int]
 *
 * Also adds necessary typing imports if not present.
 */
function convertTypeHintsIfNeeded(code: string, languageId: number): string {
  // Python 3.9+ (language ID 92+) supports modern type hints, no conversion needed
  if (languageId !== 71) {
    return code;
  }

  // Python 3.8.1 (language ID 71) needs conversion
  let converted = code;
  const needsTypingImport = /\b(list|dict|tuple|set)\[/.test(converted);

  if (needsTypingImport && !converted.includes("from typing import")) {
    // Add typing import at the top if not present
    const lines = converted.split("\n");
    let importInserted = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line && (line.trim().startsWith("import ") || line.trim().startsWith("from "))) {
        // Insert after existing imports
        lines.splice(i + 1, 0, "from typing import List, Dict, Tuple, Set, Optional, Union");
        importInserted = true;
        break;
      }
    }
    if (!importInserted) {
      lines.unshift("from typing import List, Dict, Tuple, Set, Optional, Union");
    }
    converted = lines.join("\n");
  }

  // Replace modern type hints with typing module equivalents
  // Use word boundaries to avoid replacing in strings or comments
  converted = converted.replace(/\blist\[/g, "List[");
  converted = converted.replace(/\bdict\[/g, "Dict[");
  converted = converted.replace(/\btuple\[/g, "Tuple[");
  converted = converted.replace(/\bset\[/g, "Set[");

  return converted;
}

/**
 * Build the test harness code that wraps user code and runs tests.
 *
 * The harness:
 * 1. Includes the user's code (with Python 3.8.1 compatibility conversions if needed)
 * 2. Runs each test case by calling the function with the inputs
 * 3. Compares the result with the expected output
 * 4. Prints structured output: "PASS <index>", "FAIL <index> expected=<x> got=<y>", or "ERROR <index> <msg>"
 *
 * @param userCode - The user's solution code
 * @param functionName - Name of the function to test
 * @param testCases - Array of test cases with input and output
 * @param languageId - Judge0 language ID (defaults to Python 3.10.0)
 * @returns Complete Python code ready for Judge0 execution
 */
export function buildTestHarness(
  userCode: string,
  functionName: string,
  testCases: TestCase[],
  languageId: number = PYTHON3_LANGUAGE_ID,
): string {
  // Convert type hints if using Python 3.8.1 (only needed for language ID 71)
  const compatibleCode = convertTypeHintsIfNeeded(userCode, languageId);

  const testCode = testCases
    .map((test, i) => {
      // Handle tuple inputs (convert array to tuple if needed)
      const inputStr = JSON.stringify(test.input);
      const outputStr = JSON.stringify(test.output);

      // Generate Python code with test index hardcoded
      // Use *args unpacking to handle both single values and arrays
      return `
# Test ${i + 1}
try:
    result = ${functionName}(*${inputStr})
    expected = ${outputStr}
    if result == expected:
        print("PASS ${i}")
    else:
        print(f"FAIL ${i} expected={expected!r} got={result!r}")
except Exception as e:
    print(f"ERROR ${i} {e}")
`;
    })
    .join("\n");

  return `${compatibleCode}\n\n${testCode}`;
}

/**
 * Parse Judge0 output to extract test results.
 * Parses lines in format:
 * - "PASS <index>"
 * - "FAIL <index> expected=<expected> got=<got>"
 * - "ERROR <index> <error message>"
 */
export function parseTestOutput(stdout: string): PublicTestResult[] {
  const lines = stdout.trim().split("\n");
  const results: PublicTestResult[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith("PASS ")) {
      const indexStr = trimmedLine.slice(5).trim();
      const index = parseInt(indexStr, 10);
      if (!isNaN(index) && index >= 0) {
        results.push({ index, passed: true });
      }
    } else if (trimmedLine.startsWith("FAIL ")) {
      // Match: FAIL <index> expected=<expected> got=<got>
      const match = trimmedLine.match(/^FAIL (\d+) expected=(.+) got=(.+)$/);
      if (match && match[1] && match[2] !== undefined && match[3] !== undefined) {
        const index = parseInt(match[1], 10);
        if (!isNaN(index) && index >= 0) {
          results.push({
            index,
            passed: false,
            expected: match[2].trim(),
            received: match[3].trim(),
          });
        }
      }
    } else if (trimmedLine.startsWith("ERROR ")) {
      // Match: ERROR <index> <error message>
      const match = trimmedLine.match(/^ERROR (\d+) (.+)$/);
      if (match && match[1] && match[2]) {
        const index = parseInt(match[1], 10);
        if (!isNaN(index) && index >= 0) {
          results.push({
            index,
            passed: false,
            error: match[2].trim(),
          });
        }
      }
    }
  }

  return results;
}

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Custom error class for Judge0 execution errors
 *
 * Error codes:
 * - JUDGE_UNAVAILABLE: Judge0 service is down, rate limited, or timed out
 * - INTERNAL_ERROR: Unexpected error during execution or parsing
 * - BAD_REQUEST: Invalid request parameters (should not normally occur)
 *
 * @example
 * ```ts
 * try {
 *   await runAllTests(problem, code, config);
 * } catch (error) {
 *   if (error instanceof JudgeError) {
 *     if (error.code === "JUDGE_UNAVAILABLE" && error.retryAfterMs) {
 *       // Wait and retry
 *       await sleep(error.retryAfterMs);
 *     }
 *   }
 * }
 * ```
 */
export class JudgeError extends Error {
  /**
   * @param code - Error code (e.g., "JUDGE_UNAVAILABLE", "INTERNAL_ERROR")
   * @param message - Human-readable error message
   * @param retryAfterMs - Optional retry delay in milliseconds (for rate limits)
   */
  constructor(
    public code: string,
    message: string,
    public retryAfterMs?: number,
  ) {
    super(message);
    this.name = "JudgeError";
    // Maintain proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, JudgeError);
    }
  }
}

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
  log("info", "Running public tests", { ...context, testCount: problem.publicTests.length });

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
    log("error", "Failed to run public tests", { ...context, error: error instanceof Error ? error.message : String(error) });
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
      hiddenFailureMessage: hiddenTestsPassed ? undefined : "Failed hidden tests",
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
    log("error", "Failed to run all tests", { ...context, error: error instanceof Error ? error.message : String(error) });
    throw new JudgeError(
      "INTERNAL_ERROR",
      `Failed to run all tests: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}
