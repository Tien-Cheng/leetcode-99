#!/usr/bin/env node
/**
 * Test script for @leet99/judge
 * 
 * Usage:
 *   1. Set environment variables (either method):
 *      - Export in shell: export JUDGE0_URL="..." JUDGE0_API_KEY="..."
 *      - Or create .env file in project root with:
 *        JUDGE0_URL=https://judge0-ce.p.rapidapi.com
 *        JUDGE0_API_KEY=your-key
 *        JUDGE0_RAPIDAPI_HOST=judge0-ce.p.rapidapi.com
 * 
 *   2. Run with tsx (recommended):
 *      pnpm test
 * 
 *   3. Or build first, then run:
 *      pnpm build
 *      pnpm test:build
 */

// Load .env file from project root if it exists
import { config } from "dotenv";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { existsSync } from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Try to load .env.local first, then .env from project root (2 levels up from packages/judge)
const rootDir = resolve(__dirname, "../..");
const envLocalPath = resolve(rootDir, ".env.local");
const envPath = resolve(rootDir, ".env");

// Load .env.local first (takes precedence), then .env
if (existsSync(envLocalPath)) {
  config({ path: envLocalPath });
  console.log(`Loaded .env.local from: ${envLocalPath}`);
} else if (existsSync(envPath)) {
  config({ path: envPath });
  console.log(`Loaded .env from: ${envPath}`);
} else {
  console.log(`No .env or .env.local file found (checked: ${envLocalPath}, ${envPath})`);
}

import {
  runPublicTests,
  runAllTests,
  getAvailableLanguages,
  type JudgeConfig,
} from "./src/index";
import type { ProblemFull } from "@leet99/contracts";

// Example problem for testing
const exampleProblem: ProblemFull = {
  problemId: "two-sum",
  title: "Two Sum",
  prompt: "Given an array of integers and a target, return indices of two numbers that add up to target.",
  functionName: "two_sum",
  signature: "def two_sum(nums: list[int], target: int) -> list[int]:",
  starterCode: `def two_sum(nums: list[int], target: int) -> list[int]:
    """
    Find two numbers that add up to target.
    Return their indices.
    """
    pass`,
  publicTests: [
    {
      input: [[2, 7, 11, 15], 9],
      output: [0, 1],
    },
    {
      input: [[3, 2, 4], 6],
      output: [1, 2],
    },
  ],
  hiddenTests: [
    {
      input: [[3, 3], 6],
      output: [0, 1],
    },
    {
      input: [[1, 2, 3, 4, 5], 9],
      output: [3, 4],
    },
  ],
  difficulty: "easy",
  timeLimitMs: 5000,
};

// Get config from environment variables
function getConfig(): JudgeConfig {
  const judge0Url = process.env.JUDGE0_URL;
  const judge0ApiKey = process.env.JUDGE0_API_KEY;
  const rapidApiHost = process.env.JUDGE0_RAPIDAPI_HOST;

  // Debug: show what we found (mask the key)
  const rootDir = resolve(__dirname, "../..");
  const envLocalPath = resolve(rootDir, ".env.local");
  const envPath = resolve(rootDir, ".env");
  
  console.log("Environment check:");
  console.log(`  JUDGE0_URL: ${judge0Url ? "✓ set" : "✗ missing"}`);
  console.log(`  JUDGE0_API_KEY: ${judge0ApiKey ? `✓ set (${judge0ApiKey.slice(0, 8)}...)` : "✗ missing"}`);
  console.log(`  JUDGE0_RAPIDAPI_HOST: ${rapidApiHost ? `✓ set (${rapidApiHost})` : "○ optional (not set)"}`);
  console.log(`  .env files checked: ${envLocalPath}, ${envPath}\n`);

  if (!judge0Url || !judge0ApiKey) {
    throw new Error(
      "Missing required environment variables:\n" +
        "  - JUDGE0_URL (e.g., https://judge0-ce.p.rapidapi.com)\n" +
        "  - JUDGE0_API_KEY (your RapidAPI key)\n" +
        "  - JUDGE0_RAPIDAPI_HOST (optional, e.g., judge0-ce.p.rapidapi.com)\n\n" +
        "Set them via:\n" +
        "  1. Export in shell: export JUDGE0_URL=... JUDGE0_API_KEY=...\n" +
        "  2. Or create .env file in project root with these variables",
    );
  }

  return {
    judge0Url,
    judge0ApiKey,
    rapidApiHost,
  };
}

// Test code - correct solution
const correctCode = `def two_sum(nums: list[int], target: int) -> list[int]:
    """
    Find two numbers that add up to target.
    Return their indices.
    """
    seen = {}
    for i, num in enumerate(nums):
        complement = target - num
        if complement in seen:
            return [seen[complement], i]
        seen[num] = i
    return []`;

// Test code - incorrect solution (will fail)
const incorrectCode = `def two_sum(nums: list[int], target: int) -> list[int]:
    """
    Find two numbers that add up to target.
    Return their indices.
    """
    # This is wrong - returns first two indices
    return [0, 1]`;

async function testRunPublicTests(config: JudgeConfig) {
  console.log("\n=== Testing runPublicTests (correct code) ===\n");

  const result = await runPublicTests(exampleProblem, correctCode, config);

  console.log("Result:", JSON.stringify(result, null, 2));
  console.log(`\n✅ All public tests passed: ${result.passed}`);
  console.log(`   Runtime: ${result.runtimeMs}ms`);
}

async function testRunPublicTestsIncorrect(config: JudgeConfig) {
  console.log("\n=== Testing runPublicTests (incorrect code) ===\n");

  const result = await runPublicTests(exampleProblem, incorrectCode, config);

  console.log("Result:", JSON.stringify(result, null, 2));
  console.log(`\n❌ Tests passed: ${result.passed}`);
  if (!result.passed) {
    console.log("   Failed tests:");
    result.publicTests.forEach((test, i) => {
      if (!test.passed) {
        console.log(`     Test ${i}:`, test.error || "Wrong answer");
      }
    });
  }
}

async function testRunAllTests(config: JudgeConfig) {
  console.log("\n=== Testing runAllTests (correct code) ===\n");

  const result = await runAllTests(exampleProblem, correctCode, config);

  console.log("Result:", JSON.stringify(result, null, 2));
  console.log(`\n✅ All tests passed: ${result.passed}`);
  console.log(`   Public tests passed: ${result.publicTests.every((t) => t.passed)}`);
  console.log(`   Hidden tests passed: ${result.hiddenTestsPassed ?? "unknown"}`);
  console.log(`   Runtime: ${result.runtimeMs}ms`);
}

async function testRunAllTestsIncorrect(config: JudgeConfig) {
  console.log("\n=== Testing runAllTests (incorrect code) ===\n");

  const result = await runAllTests(exampleProblem, incorrectCode, config);

  console.log("Result:", JSON.stringify(result, null, 2));
  console.log(`\n❌ All tests passed: ${result.passed}`);
  console.log(`   Public tests passed: ${result.publicTests.every((t) => t.passed)}`);
  console.log(`   Hidden tests passed: ${result.hiddenTestsPassed ?? "unknown"}`);
  if (result.hiddenFailureMessage) {
    console.log(`   Hidden failure: ${result.hiddenFailureMessage}`);
  }
}

async function findPython313LanguageId(config: JudgeConfig): Promise<number | null> {
  try {
    console.log("\n🔍 Checking available Python versions in Judge0...\n");
    const languages = await getAvailableLanguages(config);
    
    // Look for Python 3.13
    const python313 = languages.find(
      (lang) => lang.name.toLowerCase().includes("python") && 
                (lang.name.includes("3.13") || lang.name.includes("3.12") || lang.name.includes("3.11") || lang.name.includes("3.10"))
    );
    
    if (python313) {
      console.log(`✅ Found: ${python313.name} (ID: ${python313.id})`);
      return python313.id;
    }
    
    // Show all Python versions
    const pythonVersions = languages.filter((lang) =>
      lang.name.toLowerCase().includes("python"),
    );
    console.log("Available Python versions:");
    pythonVersions.forEach((lang) => {
      console.log(`  - ${lang.name} (ID: ${lang.id})${lang.isArchived ? " [archived]" : ""}`);
    });
    
    return null;
  } catch (error) {
    console.warn("⚠️  Could not query languages:", error instanceof Error ? error.message : error);
    return null;
  }
}

async function main() {
  console.log("🧪 Testing @leet99/judge with Judge0 via RapidAPI\n");

  try {
    const config = getConfig();
    
    // Try to find Python 3.13.2 or newer version
    const python313Id = await findPython313LanguageId(config);
    if (python313Id) {
      console.log(`\n📝 Using Python language ID: ${python313Id}\n`);
      config.pythonLanguageId = python313Id;
    } else {
      console.log("\n⚠️  Python 3.13.2 not found. Using default (Python 3.10.0, ID: 92)");
      console.log("   For Python 3.13.2, you'll need a self-hosted Judge0 instance.\n");
    }
    
    // Test 1: Run public tests with correct code
    await testRunPublicTests(config);

    // Test 2: Run public tests with incorrect code
    await testRunPublicTestsIncorrect(config);

    // Test 3: Run all tests (public + hidden) with correct code
    await testRunAllTests(config);

    // Test 4: Run all tests with incorrect code
    await testRunAllTestsIncorrect(config);

    console.log("\n✅ All tests completed!");
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    if (error instanceof Error) {
      console.error("   Message:", error.message);
      if ("code" in error) {
        console.error("   Code:", (error as { code: string }).code);
      }
      if ("retryAfterMs" in error) {
        console.error(
          "   Retry after:",
          (error as { retryAfterMs?: number }).retryAfterMs,
          "ms",
        );
      }
    }
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url.includes('test')) {
  main().catch(console.error);
}
