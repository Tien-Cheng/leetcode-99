import type { LogContext } from "./types.js";

/**
 * Check if we're running in a browser environment
 */
function isBrowser(): boolean {
  return typeof globalThis !== "undefined" && "window" in globalThis;
}

/**
 * Server-side logging helper (only logs on server)
 * Includes context like problemId, requestId, playerId when relevant
 */
export function log(
  level: "info" | "warn" | "error",
  message: string,
  context?: LogContext,
): void {
  // Only log on server-side
  if (isBrowser()) return;

  const timestamp = new Date().toISOString();
  const contextStr = context ? ` ${JSON.stringify(context)}` : "";
  console[level](`[${timestamp}] [judge] ${message}${contextStr}`);
}
