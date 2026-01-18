import React, { useState, useEffect } from "react";

/**
 * Detect error type from test results
 * Returns crash info if all tests have identical error (global crash)
 */
function detectErrorType(results: TestResult[]): {
  type: "compilation" | "runtime" | "timeout" | null;
  message: string | null;
  stderr: string | null;
  stdout: string | null;
} {
  if (results.length === 0) {
    return { type: null, message: null, stderr: null, stdout: null };
  }

  const firstTest = results[0];
  if (!firstTest?.error) {
    return { type: null, message: null, stderr: null, stdout: null };
  }

  // Check if all tests have same error (global crash)
  const allSameError = results.every(
    (t) => !t.passed && t.error === firstTest.error,
  );
  if (!allSameError) {
    return { type: null, message: null, stderr: null, stdout: null };
  }

  // Classify error type
  const error = firstTest.error;
  if (
    error.includes("SyntaxError") ||
    error.includes("IndentationError") ||
    error.includes("NameError")
  ) {
    return {
      type: "compilation",
      message: error,
      stderr: firstTest.stderr || null,
      stdout: firstTest.stdout || null,
    };
  }
  if (error.includes("Time limit exceeded") || error.includes("TimeoutError")) {
    return {
      type: "timeout",
      message: error,
      stderr: firstTest.stderr || null,
      stdout: firstTest.stdout || null,
    };
  }
  return {
    type: "runtime",
    message: error,
    stderr: firstTest.stderr || null,
    stdout: firstTest.stdout || null,
  };
}

/**
 * Format Python traceback with syntax highlighting
 * Adds color classes for better readability
 */
function formatPythonTraceback(traceback: string): React.JSX.Element {
  const lines = traceback.split("\n");

  return (
    <>
      {lines.map((line, idx) => {
        // File path line: '  File "<string>", line 3'
        if (line.trim().startsWith("File ")) {
          const parts = line.split(",");
          return (
            <div key={idx}>
              <span className="text-base-content/70">{parts[0]}</span>
              {parts[1] && (
                <span className="text-accent font-medium">,{parts[1]}</span>
              )}
            </div>
          );
        }

        // Error type line: 'ZeroDivisionError: division by zero'
        const errorMatch = line.match(/^(\w+Error|Exception):\s*(.+)$/);
        if (errorMatch) {
          return (
            <div key={idx} className="mt-1">
              <span className="font-bold">{errorMatch[1]}</span>
              <span>: </span>
              <span className="text-base-content/90">{errorMatch[2]}</span>
            </div>
          );
        }

        // Code snippet lines (indented)
        if (line.startsWith("    ") || line.startsWith("        ")) {
          return (
            <div
              key={idx}
              className="bg-base-300/50 px-2 py-0.5 rounded my-0.5"
            >
              {line}
            </div>
          );
        }

        // Arrow/caret lines pointing to errors
        if (line.includes("^")) {
          return (
            <div key={idx} className="text-accent font-bold">
              {line}
            </div>
          );
        }

        // Default line
        return <div key={idx}>{line}</div>;
      })}
    </>
  );
}

export interface TestResult {
  index: number;
  passed: boolean;
  input?: string;
  expected?: string;
  received?: string;
  stdout?: string;
  stderr?: string;
  error?: string;
}

export interface ProblemData {
  title: string;
  difficulty: "easy" | "medium" | "hard";
  prompt: string;
  signature: string;
  publicTests?: Array<{ input: string; output: string }>;
  isGarbage?: boolean;
  problemType?: "code" | "mcq";
  options?: Array<{ id: string; text: string }>;
  correctAnswer?: string;
  onOptionSelect?: (optionId: string) => void;
  selectedOptionId?: string;
}

export interface ProblemDisplayProps {
  problem: ProblemData;
  testResults?: TestResult[];
  hiddenTestsPassed?: boolean;
  hiddenFailureMessage?: string;
  className?: string;
  isTransitioning?: boolean;
}

/**
 * Problem Display component - shows problem with animated transitions
 * Features test result animations, success celebrations, and difficulty badges
 */
export function ProblemDisplay({
  problem,
  testResults = [],
  hiddenTestsPassed,
  hiddenFailureMessage,
  className = "",
  isTransitioning = false,
}: ProblemDisplayProps) {
  const [showTests, setShowTests] = useState(true);
  const [prevProblemId, setPrevProblemId] = useState<string | null>(null);
  const [isAnimatingIn, setIsAnimatingIn] = useState(false);
  const [revealedTests, setRevealedTests] = useState<number>(0);

  // Problem transition animation
  useEffect(() => {
    const problemId = `${problem.title}-${problem.difficulty}`;
    if (prevProblemId !== null && prevProblemId !== problemId) {
      setIsAnimatingIn(true);
      setTimeout(() => setIsAnimatingIn(false), 300);
    }
    setPrevProblemId(problemId);
  }, [problem.title, problem.difficulty, prevProblemId]);

  // Reveal test results sequentially
  useEffect(() => {
    if (testResults.length > 0) {
      setRevealedTests(0);
      const interval = setInterval(() => {
        setRevealedTests((prev) => {
          if (prev >= testResults.length) {
            clearInterval(interval);
            return prev;
          }
          return prev + 1;
        });
      }, 150);
      return () => clearInterval(interval);
    }
  }, [testResults]);

  const getDifficultyStyles = (difficulty: ProblemData["difficulty"]) => {
    switch (difficulty) {
      case "easy":
        return "bg-success/20 text-success border-success";
      case "medium":
        return "bg-warning/20 text-warning border-warning";
      case "hard":
        return "bg-error/20 text-error border-error";
      default:
        return "bg-secondary/20 text-secondary border-secondary";
    }
  };

  const getTestIcon = (result?: TestResult, isRevealed?: boolean) => {
    if (!isRevealed) return <span className="text-muted opacity-50">○</span>;
    if (!result) return <span className="text-muted">○</span>;
    return result.passed ? (
      <span className="text-success animate-score-pop">✓</span>
    ) : (
      <span className="text-error animate-shake">✗</span>
    );
  };

  const publicPassed =
    testResults.length > 0 && testResults.every((t) => t.passed);
  const allPassed = publicPassed && hiddenTestsPassed !== false; // Only true if public passed AND hidden didn't explicitly fail

  /**
   * Parse prompt text and render code blocks in code boxes
   */
  const renderPrompt = (prompt: string) => {
    // Match code blocks: ```language ... ``` or ``` ... ```
    // Handles both with and without newlines after language tag
    const codeBlockRegex = /```(\w+)?\s*\n?([\s\S]*?)```/g;
    const parts: Array<{
      type: "text" | "code";
      content: string;
      language?: string;
    }> = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(prompt)) !== null) {
      // Add text before code block
      if (match.index > lastIndex) {
        parts.push({
          type: "text",
          content: prompt.slice(lastIndex, match.index),
        });
      }

      // Add code block
      parts.push({
        type: "code",
        content: (match[2] ?? "").trim(),
        language: match[1] || "text",
      });

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < prompt.length) {
      parts.push({
        type: "text",
        content: prompt.slice(lastIndex),
      });
    }

    // If no code blocks found, return original text
    if (parts.length === 0) {
      return <>{prompt}</>;
    }

    return (
      <>
        {parts.map((part, index) => {
          if (part.type === "code") {
            // Split code by newlines and render each line explicitly
            const codeLines = part.content.split("\n");
            return (
              <div
                key={index}
                className="my-2 border border-secondary bg-base-300 p-3 rounded overflow-x-auto"
              >
                <code className="font-mono text-xs text-base-content block">
                  {codeLines.map((line, lineIndex) => (
                    <React.Fragment key={lineIndex}>
                      {line}
                      {lineIndex < codeLines.length - 1 && <br />}
                    </React.Fragment>
                  ))}
                </code>
              </div>
            );
          }
          // Render text with explicit newline preservation
          // Split by newlines and join with <br> to ensure they're displayed
          const textLines = part.content.split("\n");
          return (
            <span key={index}>
              {textLines.map((line, lineIndex) => (
                <React.Fragment key={lineIndex}>
                  {line}
                  {lineIndex < textLines.length - 1 && <br />}
                </React.Fragment>
              ))}
            </span>
          );
        })}
      </>
    );
  };

  return (
    <div
      className={`
        h-full overflow-y-auto p-3 space-y-3 border border-secondary
        ${isAnimatingIn ? "animate-slide-in-right" : ""}
        ${isTransitioning ? "opacity-50" : ""}
        ${allPassed ? "animate-success-flash" : ""}
        ${problem.isGarbage ? "striped-pattern" : ""}
        ${className}
      `}
    >
      {/* Title & Difficulty */}
      <div className="flex items-center gap-2 flex-wrap">
        <h3 className="font-mono text-lg flex-1 min-w-0 truncate">
          {problem.title}
        </h3>
        <span
          className={`
            px-2 py-1 text-xs font-mono uppercase border
            ${getDifficultyStyles(problem.difficulty)}
            ${isAnimatingIn ? "animate-score-pop" : ""}
          `}
        >
          {problem.difficulty}
        </span>
        {problem.isGarbage && (
          <span className="px-2 py-1 bg-secondary/20 text-secondary text-xs font-mono border border-secondary animate-pulse">
            ⚠ GARBAGE
          </span>
        )}
      </div>

      {/* All tests passed celebration */}
      {allPassed && (
        <div className="bg-success/10 border border-success p-2 text-center animate-slide-in-top">
          <span className="text-success font-mono text-sm font-bold">
            ✓ ALL TESTS PASSED!
          </span>
        </div>
      )}

      {/* Hidden tests failed warning */}
      {publicPassed && hiddenTestsPassed === false && (
        <div className="bg-error/10 border border-error p-2 text-center animate-shake">
          <span className="text-error font-mono text-sm font-bold">
            ✗ HIDDEN TESTS FAILED
          </span>
          {hiddenFailureMessage && (
            <div className="text-error/80 text-xs mt-1">
              {hiddenFailureMessage}
            </div>
          )}
        </div>
      )}

      {/* Prompt */}
      <div className="text-sm text-base-content leading-relaxed max-h-96 overflow-y-auto whitespace-pre-wrap">
        {renderPrompt(problem.prompt)}
      </div>

      {/* MCQ Options or Function Signature */}
      {problem.problemType === "mcq" ? (
        <div className="space-y-2">
          {problem.options?.map((option) => (
            <button
              key={option.id}
              onClick={() => problem.onOptionSelect?.(option.id)}
              className={`
                w-full text-left p-3 border font-mono text-sm transition-all
                ${
                  problem.selectedOptionId === option.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-secondary hover:border-primary/50 bg-base-300"
                }
              `}
            >
              <span className="mr-2 text-muted">
                [{problem.selectedOptionId === option.id ? "●" : " "}]
              </span>
              {option.text}
            </button>
          ))}
        </div>
      ) : (
        <div className="border border-secondary p-2 bg-base-300 hover:border-primary/50 transition-colors">
          <code className="font-mono text-xs text-base-content">
            {problem.signature}
          </code>
        </div>
      )}

      {/* Crash Display (Compilation/Runtime Errors) */}
      {testResults.length > 0 &&
        (() => {
          const crash = detectErrorType(testResults);
          if (!crash.type) return null;

          const errorTypeConfig = {
            compilation: {
              icon: "⚠️",
              title: "Compilation Error",
              bgClass: "bg-warning/10 border-warning",
              textClass: "text-warning",
            },
            runtime: {
              icon: "❌",
              title: "Runtime Error",
              bgClass: "bg-error/10 border-error",
              textClass: "text-error",
            },
            timeout: {
              icon: "⏱️",
              title: "Time Limit Exceeded",
              bgClass: "bg-info/10 border-info",
              textClass: "text-info",
            },
          };

          const config = errorTypeConfig[crash.type];

          return (
            <div className="mb-4 space-y-3 animate-slide-in-bottom">
              {/* Error Header */}
              <div
                className={`border-2 rounded-lg p-4 ${config.bgClass} animate-shake`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">{config.icon}</span>
                  <h3
                    className={`font-bold text-base font-mono ${config.textClass}`}
                  >
                    {config.title}
                  </h3>
                </div>

                {/* Error Message/Traceback */}
                <div
                  className={`font-mono text-xs whitespace-pre-wrap ${config.textClass} leading-relaxed bg-base-300/30 p-3 rounded border border-current/20`}
                >
                  {formatPythonTraceback(crash.message || "")}
                </div>
              </div>

              {/* Stderr Output (if present and different from error) */}
              {crash.stderr && crash.stderr !== crash.message && (
                <div className="border border-secondary rounded-lg p-3 bg-base-200">
                  <h4 className="font-bold text-xs text-muted mb-2 font-mono">
                    stderr:
                  </h4>
                  <pre className="font-mono text-xs text-base-content whitespace-pre-wrap leading-relaxed">
                    {crash.stderr}
                  </pre>
                </div>
              )}

              {/* Stdout Output (if present) */}
              {crash.stdout && crash.stdout.trim().length > 0 && (
                <div className="border border-secondary rounded-lg p-3 bg-base-200">
                  <h4 className="font-bold text-xs text-muted mb-2 font-mono">
                    Console Output (stdout):
                  </h4>
                  <pre className="font-mono text-xs text-base-content whitespace-pre-wrap leading-relaxed">
                    {crash.stdout}
                  </pre>
                </div>
              )}

              {/* Divider */}
              <div className="border-t border-secondary/50 my-3"></div>
            </div>
          );
        })()}

      {/* Public Tests */}
      {problem.publicTests && problem.publicTests.length > 0 && (
        <div>
          <button
            onClick={() => setShowTests(!showTests)}
            className="font-mono text-xs text-muted hover:text-base-content flex items-center gap-2 mb-2 transition-colors"
          >
            <span
              className={`transition-transform duration-200 ${showTests ? "rotate-0" : "-rotate-90"}`}
            >
              ▼
            </span>
            Public Tests ({problem.publicTests.length})
            {testResults.length > 0 && (
              <span
                className={`ml-2 ${allPassed ? "text-success" : "text-error"}`}
              >
                [{testResults.filter((t) => t.passed).length}/
                {testResults.length}]
              </span>
            )}
          </button>

          {showTests && (
            <div className="space-y-2 text-xs font-mono pl-4">
              {problem.publicTests.map((test, index) => {
                const result = testResults.find((r) => r.index === index);
                const isRevealed = index < revealedTests;
                const passed = result?.passed;

                return (
                  <div
                    key={index}
                    className={`
                      flex items-start gap-2 p-2 border transition-all duration-200
                      ${
                        !isRevealed
                          ? "border-secondary/50 opacity-70"
                          : passed === true
                            ? "border-success/50 bg-success/5"
                            : passed === false
                              ? "border-error/50 bg-error/5 animate-shake"
                              : "border-secondary"
                      }
                    `}
                  >
                    {getTestIcon(result, isRevealed)}
                    <div className="flex-1">
                      <div
                        className={result && !result.passed ? "text-error" : ""}
                      >
                        <span className="text-muted">Test {index + 1}: </span>
                        <span className="text-base-content">{test.input}</span>
                        <span className="text-muted"> → </span>
                        <span className="text-primary">{test.output}</span>
                      </div>
                      {result &&
                        !result.passed &&
                        result.received &&
                        isRevealed && (
                          <div className="text-error mt-1 pl-4 animate-slide-in-bottom">
                            Got:{" "}
                            <span className="font-bold">{result.received}</span>
                          </div>
                        )}

                      {/* Per-test stdout (only if no global crash) */}
                      {result &&
                        result.stdout &&
                        result.stdout.trim().length > 0 &&
                        isRevealed &&
                        !detectErrorType(testResults).type && (
                          <div className="mt-2 p-2 bg-base-200 rounded border border-secondary/30">
                            <span className="text-xs text-muted font-bold block mb-1">
                              Console Output:
                            </span>
                            <pre className="text-xs font-mono whitespace-pre-wrap text-base-content/80 leading-relaxed">
                              {result.stdout}
                            </pre>
                          </div>
                        )}

                      {/* Per-test stderr (only if no global crash) */}
                      {result &&
                        result.stderr &&
                        isRevealed &&
                        !detectErrorType(testResults).type && (
                          <div className="mt-2 p-2 bg-error/5 border border-error/20 rounded">
                            <span className="text-xs text-error font-bold block mb-1">
                              stderr:
                            </span>
                            <pre className="text-xs font-mono whitespace-pre-wrap text-error/90 leading-relaxed">
                              {result.stderr}
                            </pre>
                          </div>
                        )}

                      {/* Per-test error (only if no global crash) */}
                      {result &&
                        result.error &&
                        isRevealed &&
                        !detectErrorType(testResults).type && (
                          <div className="mt-2 p-2 bg-error/5 border border-error/20 rounded">
                            <span className="text-xs text-error font-bold block mb-1">
                              Error:
                            </span>
                            <pre className="text-xs font-mono whitespace-pre-wrap text-error/90 leading-relaxed">
                              {result.error}
                            </pre>
                          </div>
                        )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
