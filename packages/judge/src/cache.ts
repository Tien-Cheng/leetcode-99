import { createHash } from "node:crypto";
import type { JudgeResult } from "@leet99/contracts";
import type { CacheEntry } from "./types.js";
import { CACHE_TTL_MS, CACHE_CLEANUP_INTERVAL_MS } from "./constants.js";
import { log } from "./logger.js";

// ============================================================================
// Cache State
// ============================================================================

const cache = new Map<string, CacheEntry>();
let cacheCleanupTimer: NodeJS.Timeout | null = null;

// ============================================================================
// Cache Lifecycle
// ============================================================================

/**
 * Check if we're running in a browser environment
 */
function isBrowser(): boolean {
  return typeof globalThis !== "undefined" && "window" in globalThis;
}

/**
 * Start automatic cache cleanup (called automatically on first cache use)
 */
function startCacheCleanup(): void {
  // Only run on server-side
  if (isBrowser()) return;
  if (cacheCleanupTimer) return; // Already started

  log("info", "Starting automatic cache cleanup", {
    intervalMs: CACHE_CLEANUP_INTERVAL_MS,
  });

  cacheCleanupTimer = setInterval(() => {
    const removed = cleanupCache();
    if (removed > 0) {
      log("info", "Cache cleanup completed", {
        entriesRemoved: removed,
        entriesRemaining: cache.size,
      });
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

// ============================================================================
// Cache Operations
// ============================================================================

/**
 * Generate cache key from problemId and code hash
 */
export function getCacheKey(problemId: string, code: string): string {
  const hash = createHash("sha256").update(code).digest("hex").slice(0, 16);
  return `${problemId}:${hash}`;
}

/**
 * Check cache for existing result
 */
export function getCachedResult(key: string): JudgeResult | null {
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
export function setCachedResult(key: string, result: JudgeResult): void {
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
