// ============================================================================
// Judge0 Language IDs
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
export const PYTHON3_LANGUAGE_ID = 92; // Python 3.10.0 (default)

// ============================================================================
// Judge0 Status IDs
// ============================================================================

/**
 * Judge0 status IDs
 * See: https://ce.judge0.com/#statuses-and-languages-status-get
 *
 * Note: We determine acceptance by parsing test harness output, not by checking
 * STATUS_ACCEPTED, because our harness runs multiple test cases and reports
 * individual pass/fail results. Judge0's status only indicates execution success.
 */
export const STATUS_ACCEPTED = 3; // Execution succeeded (but individual tests may still fail)
export const STATUS_WRONG_ANSWER = 4;
export const STATUS_TIME_LIMIT_EXCEEDED = 5;
export const STATUS_COMPILATION_ERROR = 6;
export const STATUS_RUNTIME_ERROR = 7;

// ============================================================================
// Cache Configuration
// ============================================================================

/** Cache time-to-live in milliseconds (30 seconds) */
export const CACHE_TTL_MS = 30_000;

/** Cache cleanup interval in milliseconds (60 seconds) */
export const CACHE_CLEANUP_INTERVAL_MS = 60_000;

// ============================================================================
// Judge0 API Configuration
// ============================================================================

/** Poll interval for checking submission status (milliseconds) */
export const POLL_INTERVAL_MS = 500;

/** Default memory limit in kilobytes (128 MB) */
export const DEFAULT_MEMORY_LIMIT_KB = 128 * 1024;

// ============================================================================
// Python Execution Limits
// ============================================================================

/**
 * Default recursion limit for Python execution.
 * Set higher than Python's default (1000) to allow recursive solutions,
 * but capped to prevent stack overflow attacks and memory exhaustion.
 *
 * Considerations:
 * - Python default is 1000, which may be too low for some recursive algorithms
 * - Setting too high risks memory exhaustion from deep recursion
 * - 3000 allows most legitimate recursive solutions while limiting abuse
 */
export const PYTHON_RECURSION_LIMIT = 3000;
