import React, { useEffect, useState, useRef } from "react";

export interface StackProblem {
  id: string;
  title: string;
  difficulty: "easy" | "medium" | "hard";
  isGarbage?: boolean;
  isNew?: boolean;
}

export interface StackPanelProps {
  stack: StackProblem[];
  stackLimit: number;
  memoryLeakActive?: boolean;
  className?: string;
}

/**
 * Stack Panel component - animated vertical stack of problems
 * Features smooth sliding, overflow warnings, and removal animations
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
  const isOverflow = stackSize >= stackLimit;

  const [prevStackSize, setPrevStackSize] = useState(stackSize);
  const [isShaking, setIsShaking] = useState(false);
  const [newProblemIds, setNewProblemIds] = useState<Set<string>>(new Set());

  // Detect new problems added
  useEffect(() => {
    if (stackSize > prevStackSize) {
      // New problem(s) added
      const newIds = new Set(stack.slice(0, stackSize - prevStackSize).map(p => p.id));
      setNewProblemIds(newIds);

      // Clear animation after it completes
      setTimeout(() => setNewProblemIds(new Set()), 500);

      // Shake on overflow warning
      if (isNearOverflow) {
        setIsShaking(true);
        setTimeout(() => setIsShaking(false), 500);
      }
    }
    setPrevStackSize(stackSize);
  }, [stackSize, prevStackSize, stack, isNearOverflow]);

  const getDifficultyStyles = (difficulty: StackProblem["difficulty"]) => {
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

  const getContainerStyles = () => {
    if (isOverflow) return "border-error animate-pulse-red glow-danger";
    if (isCritical) return "border-error animate-pulse-red";
    if (isNearOverflow) return "border-warning animate-pulse-amber";
    if (memoryLeakActive) return "border-warning animate-pulse-amber";
    return "border-secondary";
  };

  return (
    <div
      className={`
        border transition-all duration-300
        ${getContainerStyles()}
        ${isShaking ? "animate-shake" : ""}
        ${className}
      `}
    >
      {/* Header */}
      <div className="border-b border-secondary bg-base-300 px-4 py-2 font-mono text-sm flex items-center justify-between">
        <span className={`flex items-center gap-2 ${isOverflow ? "text-error font-bold" : ""}`}>
          STACK
          <span className={`
            px-2 py-0.5 text-xs 
            ${isOverflow ? "bg-error text-error-content" : isNearOverflow ? "bg-warning/20 text-warning" : "bg-base-200"}
          `}>
            {stackSize}/{stackLimit}
          </span>
        </span>
        <div className="flex items-center gap-2">
          {memoryLeakActive && (
            <span className="text-warning text-xs animate-pulse glitch-text" data-text="[LEAK]">
              [LEAK]
            </span>
          )}
          {isOverflow && (
            <span className="text-error text-xs font-bold animate-fire">
              OVERFLOW!
            </span>
          )}
        </div>
      </div>

      {/* Stack Items */}
      <div className="p-2 space-y-2 max-h-96 overflow-y-auto relative">
        {/* Capacity bar */}
        <div className="h-1 bg-base-300 mb-2 overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${isOverflow ? "bg-error" : isNearOverflow ? "bg-warning" : "bg-success"
              }`}
            style={{ width: `${Math.min(100, (stackSize / stackLimit) * 100)}%` }}
          />
        </div>

        {stack.length === 0 ? (
          <div className="text-muted text-center py-8 font-mono text-sm">
            Stack empty
          </div>
        ) : (
          stack.map((problem, index) => {
            const isNew = newProblemIds.has(problem.id);

            return (
              <div
                key={problem.id}
                className={`
                  flex items-center gap-2 p-2 border border-secondary
                  gpu-accelerated
                  ${isNew ? "animate-slide-in-left" : ""}
                  ${problem.isGarbage ? "striped-pattern opacity-75" : ""}
                  ${index === 0 ? "ring-1 ring-primary/30" : ""}
                  transition-all duration-200 hover:border-primary/50
                `}
                style={{
                  animationDelay: isNew ? `${index * 50}ms` : undefined,
                }}
              >
                {/* Position indicator */}
                <span className="text-muted text-xs font-mono w-4">
                  {index + 1}
                </span>

                {/* Difficulty bar */}
                <div
                  className={`w-1 h-8 ${getDifficultyStyles(problem.difficulty)} ${isNew ? "animate-glow-pulse" : ""
                    }`}
                />

                {/* Problem title */}
                <span className="font-mono text-xs flex-1 truncate">
                  {problem.title}
                  {problem.isGarbage && (
                    <span className="ml-2 text-muted text-[10px]">[GARBAGE]</span>
                  )}
                </span>

                {/* Difficulty badge */}
                <span className={`text-[10px] font-mono px-1 ${problem.difficulty === "easy" ? "text-success" :
                    problem.difficulty === "medium" ? "text-warning" : "text-error"
                  }`}>
                  {problem.difficulty.charAt(0).toUpperCase()}
                </span>
              </div>
            );
          })
        )}

        {/* Overflow warning line */}
        {stackSize > 0 && (
          <div className={`
            border-t-2 border-dashed mt-2 pt-2 transition-all duration-300
            ${isNearOverflow ? "border-warning" : "border-error/50"}
          `}>
            <div className={`
              text-center font-mono text-xs
              ${isOverflow ? "text-error font-bold animate-pulse" : isNearOverflow ? "text-warning" : "text-muted"}
            `}>
              {isOverflow ? "⚠ STACK OVERFLOW - CLEAR PROBLEMS! ⚠" :
                isCritical ? "⚠ DANGER ZONE" : "── OVERFLOW LINE ──"}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
