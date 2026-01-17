import type {
  ProblemFull,
  JudgeResult,
  PublicTestResult,
} from "@leet99/contracts";

/**
 * @leet99/judge - Judge0 adapter for code execution
 *
 * Provides functions for running code against test cases.
 * - runPublicTests: Runs public tests only (for RUN_CODE)
 * - runAllTests: Runs public + hidden tests (for SUBMIT_CODE)
 */

// Judge0 language ID for Python 3
const PYTHON3_LANGUAGE_ID = 71;

export interface JudgeConfig {
  judge0Url: string;
  judge0ApiKey: string;
  /** Additional headers for RapidAPI */
  rapidApiHost?: string;
}

/**
 * Run public tests only (for RUN_CODE).
 * Does not affect score or trigger attacks.
 */
export async function runPublicTests(
  problem: ProblemFull,
  code: string,
  _config: JudgeConfig,
): Promise<JudgeResult> {
  // TODO: Implement actual Judge0 integration
  // For now, return a mock result

  const publicTests: PublicTestResult[] = problem.publicTests.map(
    (test, index) => ({
      index,
      passed: true, // Mock: all pass
      expected: test.output,
      received: test.output,
    }),
  );

  return {
    kind: "run",
    problemId: problem.problemId,
    passed: true,
    publicTests,
    runtimeMs: Math.floor(Math.random() * 100) + 10,
  };
}

/**
 * Run all tests (public + hidden) for SUBMIT_CODE.
 * This is the authoritative result that affects scoring.
 */
export async function runAllTests(
  problem: ProblemFull,
  code: string,
  _config: JudgeConfig,
): Promise<JudgeResult> {
  // TODO: Implement actual Judge0 integration
  // For now, return a mock result

  const publicTests: PublicTestResult[] = problem.publicTests.map(
    (test, index) => ({
      index,
      passed: true, // Mock: all pass
      expected: test.output,
      received: test.output,
    }),
  );

  return {
    kind: "submit",
    problemId: problem.problemId,
    passed: true,
    publicTests,
    runtimeMs: Math.floor(Math.random() * 100) + 10,
    hiddenTestsPassed: true,
  };
}

/**
 * Build the test harness code that wraps user code and runs tests.
 */
export function buildTestHarness(
  userCode: string,
  functionName: string,
  testCases: Array<{ input: unknown; output: unknown }>,
): string {
  const testCode = testCases
    .map(
      (test, i) => `
# Test ${i + 1}
try:
    result = ${functionName}(*${JSON.stringify(test.input)})
    expected = ${JSON.stringify(test.output)}
    if result == expected:
        print(f"PASS {${i}}")
    else:
        print(f"FAIL {${i}} expected={expected!r} got={result!r}")
except Exception as e:
    print(f"ERROR {${i}} {e}")
`,
    )
    .join("\n");

  return `${userCode}\n\n${testCode}`;
}

/**
 * Parse Judge0 output to extract test results.
 */
export function parseTestOutput(stdout: string): PublicTestResult[] {
  const lines = stdout.trim().split("\n");
  const results: PublicTestResult[] = [];

  for (const line of lines) {
    if (line.startsWith("PASS ")) {
      const index = parseInt(line.slice(5), 10);
      results.push({ index, passed: true });
    } else if (line.startsWith("FAIL ")) {
      const match = line.match(/FAIL (\d+) expected=(.+) got=(.+)/);
      if (match) {
        results.push({
          index: parseInt(match[1]!, 10),
          passed: false,
          expected: match[2],
          received: match[3],
        });
      }
    } else if (line.startsWith("ERROR ")) {
      const match = line.match(/ERROR (\d+) (.+)/);
      if (match) {
        results.push({
          index: parseInt(match[1]!, 10),
          passed: false,
          error: match[2],
        });
      }
    }
  }

  return results;
}
