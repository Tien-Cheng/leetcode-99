import type {
  JudgeConfig,
  Judge0Submission,
  Judge0Response,
  Judge0Language,
  LogContext,
} from "./types.js";
import { POLL_INTERVAL_MS } from "./constants.js";
import { JudgeError } from "./errors.js";
import { log } from "./logger.js";

// ============================================================================
// HTTP Helpers
// ============================================================================

/**
 * Build common headers for Judge0 API requests
 */
function buildHeaders(config: JudgeConfig): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RapidAPI-Key": config.judge0ApiKey,
  };

  if (config.rapidApiHost) {
    headers["X-RapidAPI-Host"] = config.rapidApiHost;
  }

  return headers;
}

// ============================================================================
// Language Discovery
// ============================================================================

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
  const headers = buildHeaders(config);

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

  const languages = (await response.json()) as Judge0Language[];

  return languages.map((lang) => ({
    id: lang.id,
    name: lang.name,
    isArchived: lang.is_archived,
  }));
}

// ============================================================================
// Submission Management
// ============================================================================

/**
 * Create a submission in Judge0
 * @throws {JudgeError} If submission creation fails
 */
export async function createSubmission(
  config: JudgeConfig,
  submission: Judge0Submission,
  context?: LogContext,
): Promise<string> {
  const url = new URL("/submissions", config.judge0Url);
  url.searchParams.set("base64_encoded", "false");
  url.searchParams.set("wait", "false"); // Poll for results

  const headers = {
    ...buildHeaders(config),
    "Content-Type": "application/json",
  };

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
        const retryAfterMs = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : undefined;
        log("warn", "Rate limit exceeded", { ...context, retryAfterMs });
        throw new JudgeError(
          "JUDGE_UNAVAILABLE",
          "Rate limit exceeded",
          retryAfterMs,
        );
      }
      if (response.status >= 500) {
        log("error", "Judge0 service unavailable", {
          ...context,
          status: response.status,
        });
        throw new JudgeError("JUDGE_UNAVAILABLE", "Judge0 service unavailable");
      }
      const errorText = await response.text().catch(() => "Unknown error");
      log("error", "Judge0 API error", {
        ...context,
        status: response.status,
        error: errorText,
      });
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
    log("error", "Failed to create submission", {
      ...context,
      error: error instanceof Error ? error.message : String(error),
    });
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
export async function getSubmissionResult(
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

  const headers = buildHeaders(config);

  const startTime = Date.now();
  const maxPolls = Math.ceil(maxWaitMs / POLL_INTERVAL_MS);

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
          const retryAfterMs = retryAfter
            ? parseInt(retryAfter, 10) * 1000
            : undefined;
          log("warn", "Rate limit exceeded while polling", {
            ...context,
            token,
            retryAfterMs,
          });
          throw new JudgeError(
            "JUDGE_UNAVAILABLE",
            "Rate limit exceeded",
            retryAfterMs,
          );
        }
        if (response.status >= 500) {
          log("error", "Judge0 service unavailable while polling", {
            ...context,
            token,
            status: response.status,
          });
          throw new JudgeError(
            "JUDGE_UNAVAILABLE",
            "Judge0 service unavailable",
          );
        }
        const errorText = await response.text().catch(() => "Unknown error");
        log("error", "Judge0 API error while polling", {
          ...context,
          token,
          status: response.status,
          error: errorText,
        });
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
        log("error", "Submission timeout", {
          ...context,
          token,
          maxWaitMs,
          elapsedMs: Date.now() - startTime,
        });
        throw new JudgeError(
          "JUDGE_UNAVAILABLE",
          "Submission timeout - Judge0 did not respond in time",
        );
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    } catch (error) {
      if (error instanceof JudgeError) {
        throw error;
      }
      log("error", "Failed to poll submission", {
        ...context,
        token,
        error: error instanceof Error ? error.message : String(error),
      });
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
