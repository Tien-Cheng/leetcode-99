import type {
  JudgeResult,
  PublicTestResult,
} from "@leet99/contracts";

// ============================================================================
// Logging Types
// ============================================================================

export interface LogContext {
  problemId?: string;
  requestId?: string;
  playerId?: string;
  [key: string]: unknown;
}

// ============================================================================
// Judge0 Configuration
// ============================================================================

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

// ============================================================================
// Judge0 API Types (internal)
// ============================================================================

/**
 * Judge0 submission request payload
 * See: https://ce.judge0.com/#submissions-submission-post
 */
export interface Judge0Submission {
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
export interface Judge0Response {
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

/**
 * Judge0 language info returned from /languages endpoint
 */
export interface Judge0Language {
  id: number;
  name: string;
  is_archived: boolean;
}

// ============================================================================
// Cache Types
// ============================================================================

export interface CacheEntry {
  result: JudgeResult;
  expiresAt: number;
}

// ============================================================================
// Internal Result Types
// ============================================================================

export interface ExecuteTestsResult {
  publicTests: PublicTestResult[];
  runtimeMs?: number;
  stderr?: string;
}
