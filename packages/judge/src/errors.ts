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
