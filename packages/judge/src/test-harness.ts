import type { TestCase, PublicTestResult } from "@leet99/contracts";
import { PYTHON3_LANGUAGE_ID, PYTHON_RECURSION_LIMIT } from "./constants.js";

// ============================================================================
// Type Hint Conversion (Python 3.8 Compatibility)
// ============================================================================

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
export function convertTypeHintsIfNeeded(
  code: string,
  languageId: number,
): string {
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
      if (
        line &&
        (line.trim().startsWith("import ") ||
          line.trim().startsWith("from "))
      ) {
        // Insert after existing imports
        lines.splice(
          i + 1,
          0,
          "from typing import List, Dict, Tuple, Set, Optional, Union",
        );
        importInserted = true;
        break;
      }
    }
    if (!importInserted) {
      lines.unshift(
        "from typing import List, Dict, Tuple, Set, Optional, Union",
      );
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

// ============================================================================
// Test Harness Builder
// ============================================================================

/**
 * Build the test harness code that wraps user code and runs tests.
 *
 * The harness:
 * 1. Sets Python recursion limit to prevent stack overflow while allowing recursive solutions
 * 2. Includes the user's code (with Python 3.8.1 compatibility conversions if needed)
 * 3. Runs each test case by calling the function with the inputs
 * 4. Compares the result with the expected output
 * 5. Prints structured output: "PASS <index>", "FAIL <index> expected=<x> got=<y>", or "ERROR <index> <msg>"
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

  // Set recursion limit to allow recursive solutions while preventing abuse
  const setupCode = `import sys
sys.setrecursionlimit(${PYTHON_RECURSION_LIMIT})
`;

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

  return `${setupCode}\n${compatibleCode}\n\n${testCode}`;
}

// ============================================================================
// Test Output Parser
// ============================================================================

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
