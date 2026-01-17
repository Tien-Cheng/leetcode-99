import React from "react";

export interface StackProblem {
  id: string;
  title: string;
  difficulty: "easy" | "medium" | "hard";
  isGarbage?: boolean;
}

export interface StackPanelProps {
  stack: StackProblem[];
  stackLimit: number;
  memoryLeakActive?: boolean;
  className?: string;
}

/**
 * Stack Panel component - vertical stack of problems
 * Shows difficulty bars, warnings for overflow, animations for new items
 */
export function StackPanel({
  stack,
  stackLimit,
  memoryLeakActive = false,
  className = "",
}: StackPanelProps) {
  const stackSize = stack.length;
  const isNearOverflow = stackSize >= stackLimit - 2;
  const isCritical = stackSize >= stackLimit - 1;

  const getDifficultyColor = (difficulty: StackProblem["difficulty"]) => {
    switch (difficulty) {
      case "easy":
        return "bg-success";
      case "medium":
        return "bg-warning";
      case "hard":
        return "bg-error";
      default:
        return "bg-secondary";
    }
  };

  return (
    <div
      className={`
        border
        ${isNearOverflow ? "animate-pulse-red" : isCritical ? "animate-pulse-red" : "border-secondary"}
        ${memoryLeakActive ? "animate-pulse-amber" : ""}
        ${className}
      `}
    >
      {/* Header */}
      <div className="border-b border-secondary bg-base-300 px-4 py-2 font-mono text-sm flex items-center justify-between">
        <span>
          STACK ({stackSize}/{stackLimit})
        </span>
        {memoryLeakActive && (
          <span className="text-warning text-xs">[MEMORY LEAK]</span>
        )}
      </div>

      {/* Stack Items */}
      <div className="p-2 space-y-2 max-h-96 overflow-y-auto">
        {stack.map((problem, index) => (
          <div
            key={problem.id}
            className={`
              flex items-center gap-2 p-2 border border-secondary
              gpu-accelerated animate-slide-in-top
              ${problem.isGarbage ? "striped-pattern opacity-75" : ""}
            `}
          >
            {/* Difficulty bar */}
            <div
              className={`w-1 h-8 ${getDifficultyColor(problem.difficulty)}`}
            />

            {/* Problem title */}
            <span className="font-mono text-xs flex-1 truncate">
              {problem.title}
              {problem.isGarbage && (
                <span className="ml-2 text-muted">[GARBAGE]</span>
              )}
            </span>
          </div>
        ))}

        {/* Overflow line */}
        {stackSize > 0 && (
          <div className="border-t-2 border-dashed border-error mt-2 pt-2">
            <div className="text-center font-mono text-xs text-error">
              {stackSize > stackLimit ? "OVERFLOW!" : "OVERFLOW LINE"}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
