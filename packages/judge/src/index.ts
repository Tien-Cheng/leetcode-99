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
// Types
// ============================================================================

export type { JudgeConfig } from "./types.js";

// ============================================================================
// Errors
// ============================================================================

export { JudgeError } from "./errors.js";

// ============================================================================
// Cache Management
// ============================================================================

export { cleanupCache, stopCacheCleanup } from "./cache.js";

// ============================================================================
// Judge0 Language Discovery
// ============================================================================

export { getAvailableLanguages } from "./judge0-client.js";

// ============================================================================
// Test Harness (exported for testing)
// ============================================================================

export { buildTestHarness, parseTestOutput } from "./test-harness.js";

// ============================================================================
// Main API
// ============================================================================

export { runPublicTests, runAllTests } from "./runner.js";
