import React, { useState } from "react";

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
}

export interface ProblemDisplayProps {
  problem: ProblemData;
  testResults?: TestResult[];
  className?: string;
}

/**
 * Problem Display component - shows problem details and test results
 * Includes collapsible sections and color-coded difficulty badges
 */
export function ProblemDisplay({
  problem,
  testResults = [],
  className = "",
}: ProblemDisplayProps) {
  const [showTests, setShowTests] = useState(true);

  const getDifficultyColor = (difficulty: ProblemData["difficulty"]) => {
    switch (difficulty) {
      case "easy":
        return "bg-success/20 text-success";
      case "medium":
        return "bg-warning/20 text-warning";
      case "hard":
        return "bg-error/20 text-error";
      default:
        return "bg-secondary/20 text-secondary";
    }
  };

  const getTestIcon = (result?: TestResult) => {
    if (!result) return <span className="text-muted">○</span>;
    return result.passed ? (
      <span className="text-success">✓</span>
    ) : (
      <span className="text-error">✗</span>
    );
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Title & Difficulty */}
      <div className="flex items-center gap-2">
        <h3 className="font-mono text-lg flex-1">{problem.title}</h3>
        <span
          className={`px-2 py-1 text-xs font-mono uppercase ${getDifficultyColor(problem.difficulty)}`}
        >
          {problem.difficulty}
        </span>
        {problem.isGarbage && (
          <span className="px-2 py-1 bg-secondary/20 text-secondary text-xs font-mono">
            GARBAGE
          </span>
        )}
      </div>

      {/* Prompt */}
      <div className="text-sm text-base-content leading-relaxed max-h-32 overflow-y-auto">
        {problem.prompt}
      </div>

      {/* Function Signature */}
      <div className="border border-secondary p-2 bg-base-300">
        <code className="font-mono text-xs text-base-content">
          {problem.signature}
        </code>
      </div>

      {/* Public Tests */}
      {problem.publicTests && problem.publicTests.length > 0 && (
        <div>
          <button
            onClick={() => setShowTests(!showTests)}
            className="font-mono text-xs text-muted hover:text-base-content flex items-center gap-2 mb-1"
          >
            <span>{showTests ? "▼" : "▶"}</span>
            Public Tests
          </button>

          {showTests && (
            <div className="space-y-1 text-xs font-mono pl-4">
              {problem.publicTests.map((test, index) => {
                const result = testResults.find((r) => r.index === index);
                return (
                  <div key={index} className="flex items-start gap-2">
                    {getTestIcon(result)}
                    <span className={result && !result.passed ? "text-error" : ""}>
                      Test {index + 1}: {test.input} → {test.output}
                      {result && !result.passed && result.received && (
                        <span className="block text-muted ml-4">
                          Got: {result.received}
                        </span>
                      )}
                    </span>
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
