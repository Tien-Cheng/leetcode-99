import React, { useState, useEffect } from "react";

export interface TestResult {
  index: number;
  passed: boolean;
  input?: string;
  expected?: string;
  received?: string;
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

  const allPassed = testResults.length > 0 && testResults.every((t) => t.passed);

  /**
   * Parse prompt text and render code blocks in code boxes
   */
  const renderPrompt = (prompt: string) => {
    // Match code blocks: ```language ... ``` or ``` ... ```
    // Handles both with and without newlines after language tag
    const codeBlockRegex = /```(\w+)?\s*\n?([\s\S]*?)```/g;
    const parts: Array<{ type: "text" | "code"; content: string; language?: string }> = [];
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
        <h3 className="font-mono text-lg flex-1 min-w-0 truncate">{problem.title}</h3>
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
                ${problem.selectedOptionId === option.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-secondary hover:border-primary/50 bg-base-300"}
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

      {/* Public Tests */}
      {problem.publicTests && problem.publicTests.length > 0 && (
        <div>
          <button
            onClick={() => setShowTests(!showTests)}
            className="font-mono text-xs text-muted hover:text-base-content flex items-center gap-2 mb-2 transition-colors"
          >
            <span className={`transition-transform duration-200 ${showTests ? "rotate-0" : "-rotate-90"}`}>
              ▼
            </span>
            Public Tests ({problem.publicTests.length})
            {testResults.length > 0 && (
              <span className={`ml-2 ${allPassed ? "text-success" : "text-error"}`}>
                [{testResults.filter((t) => t.passed).length}/{testResults.length}]
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
                      ${!isRevealed ? "border-secondary/50 opacity-70" :
                        passed === true ? "border-success/50 bg-success/5" :
                          passed === false ? "border-error/50 bg-error/5 animate-shake" :
                            "border-secondary"}
                    `}
                  >
                    {getTestIcon(result, isRevealed)}
                    <div className="flex-1">
                      <div className={result && !result.passed ? "text-error" : ""}>
                        <span className="text-muted">Test {index + 1}: </span>
                        <span className="text-base-content">{test.input}</span>
                        <span className="text-muted"> → </span>
                        <span className="text-primary">{test.output}</span>
                      </div>
                      {result && !result.passed && result.received && isRevealed && (
                        <div className="text-error mt-1 pl-4 animate-slide-in-bottom">
                          Got: <span className="font-bold">{result.received}</span>
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
