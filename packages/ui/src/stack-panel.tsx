import React, { useEffect, useMemo, useRef, useState } from "react";

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
  incomingIntervalMs?: number;
  fallDurationMs?: number;
  clearDurationMs?: number;
}

type StackDisplayItem = {
  problem: StackProblem;
  state: "active" | "clearing";
  key: string;
  index: number;
};

type StackSlot = {
  slotIndex: number;
  item: StackDisplayItem | null;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/**
 * Stack Panel component - animated vertical stack of problems
 * Features smooth sliding, overflow warnings, and removal animations
 */
export function StackPanel({
  stack,
  stackLimit,
  memoryLeakActive = false,
  className = "",
  incomingIntervalMs,
  fallDurationMs,
  clearDurationMs,
}: StackPanelProps) {
  const stackSize = stack.length;
  const isNearOverflow = stackSize >= stackLimit - 2;
  const isCritical = stackSize >= stackLimit - 1;
  const isOverflow = stackSize >= stackLimit;

  const [isShaking, setIsShaking] = useState(false);
  const [newProblemIds, setNewProblemIds] = useState<Set<string>>(new Set());
  const [clearingItems, setClearingItems] = useState<StackDisplayItem[]>([]);
  const [lineClearActive, setLineClearActive] = useState(false);
  const [laneFlashActive, setLaneFlashActive] = useState(false);
  const prevStackRef = useRef<StackProblem[]>(stack);
  const newItemsTimeoutRef = useRef<number | null>(null);
  const laneFlashTimeoutRef = useRef<number | null>(null);
  const shakeTimeoutRef = useRef<number | null>(null);
  const lineClearTimeoutRef = useRef<number | null>(null);
  const clearingTimeoutsRef = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      if (newItemsTimeoutRef.current) {
        window.clearTimeout(newItemsTimeoutRef.current);
      }
      if (laneFlashTimeoutRef.current) {
        window.clearTimeout(laneFlashTimeoutRef.current);
      }
      if (shakeTimeoutRef.current) {
        window.clearTimeout(shakeTimeoutRef.current);
      }
      if (lineClearTimeoutRef.current) {
        window.clearTimeout(lineClearTimeoutRef.current);
      }
      clearingTimeoutsRef.current.forEach((timeoutId) =>
        window.clearTimeout(timeoutId),
      );
    };
  }, []);

  const baseIntervalMs = incomingIntervalMs ?? 900;
  const effectiveIntervalMs = memoryLeakActive
    ? Math.round(baseIntervalMs * 0.55)
    : baseIntervalMs;
  const computedFallDurationMs =
    fallDurationMs ?? clamp(Math.round(effectiveIntervalMs * 0.7), 350, 1200);
  const computedClearDurationMs = clearDurationMs ?? 320;
  const fallStaggerMs = Math.min(
    effectiveIntervalMs / stackLimit,
    Math.max(40, Math.round(computedFallDurationMs / 6)),
  );
  const laneFlowDurationMs = Math.min(
    1200,
    Math.max(520, Math.round(computedFallDurationMs * 1.4)),
  );
  const stackRowHeight = 36;
  const stackRowGap = 6;
  const stackRowStep = stackRowHeight + stackRowGap;
  const stackMinHeight =
    stackLimit * stackRowHeight + (stackLimit - 1) * stackRowGap;

  useEffect(() => {
    const prevStack = prevStackRef.current;
    const prevIds = new Set(prevStack.map((problem) => problem.id));
    const nextIds = new Set(stack.map((problem) => problem.id));

    const addedProblems = stack.filter((problem) => !prevIds.has(problem.id));
    const removedProblems = prevStack
      .map((problem, index) => ({ problem, index }))
      .filter(({ problem }) => !nextIds.has(problem.id));

    if (addedProblems.length > 0) {
      if (newItemsTimeoutRef.current) {
        window.clearTimeout(newItemsTimeoutRef.current);
      }
      if (laneFlashTimeoutRef.current) {
        window.clearTimeout(laneFlashTimeoutRef.current);
      }

      setNewProblemIds(new Set(addedProblems.map((problem) => problem.id)));
      setLaneFlashActive(true);

      newItemsTimeoutRef.current = window.setTimeout(
        () => setNewProblemIds(new Set()),
        computedFallDurationMs + 240,
      );
      laneFlashTimeoutRef.current = window.setTimeout(
        () => setLaneFlashActive(false),
        Math.min(420, computedFallDurationMs),
      );

      if (isNearOverflow) {
        if (shakeTimeoutRef.current) {
          window.clearTimeout(shakeTimeoutRef.current);
        }
        setIsShaking(true);
        shakeTimeoutRef.current = window.setTimeout(
          () => setIsShaking(false),
          450,
        );
      }
    }

    if (removedProblems.length > 0) {
      const clearedAt = Date.now();
      const clearingBatch: StackDisplayItem[] = removedProblems.map(
        ({ problem, index }) => ({
          problem,
          state: "clearing",
          key: `${problem.id}-clearing-${clearedAt}-${index}`,
          index,
        }),
      );
      const clearingKeys = new Set(clearingBatch.map((item) => item.key));

      setClearingItems((current) => [...current, ...clearingBatch]);

      const clearTimeoutId = window.setTimeout(() => {
        setClearingItems((current) =>
          current.filter((item) => !clearingKeys.has(item.key)),
        );
        clearingTimeoutsRef.current = clearingTimeoutsRef.current.filter(
          (timeoutId) => timeoutId !== clearTimeoutId,
        );
      }, computedClearDurationMs);

      clearingTimeoutsRef.current.push(clearTimeoutId);

      if (removedProblems.length > 1) {
        if (lineClearTimeoutRef.current) {
          window.clearTimeout(lineClearTimeoutRef.current);
        }
        setLineClearActive(true);
        lineClearTimeoutRef.current = window.setTimeout(
          () => setLineClearActive(false),
          computedClearDurationMs,
        );
      }
    }

    prevStackRef.current = stack;
  }, [stack, computedFallDurationMs, computedClearDurationMs, isNearOverflow]);

  const displayStack = useMemo(() => {
    const activeItems: StackDisplayItem[] = stack.map((problem, index) => ({
      problem,
      state: "active",
      key: problem.id,
      index,
    }));

    if (clearingItems.length === 0) {
      return activeItems;
    }

    const merged = [...activeItems];
    const sortedClearing = [...clearingItems].sort((a, b) => a.index - b.index);

    sortedClearing.forEach((item) => {
      const insertIndex = Math.min(item.index, merged.length);
      merged.splice(insertIndex, 0, item);
    });

    return merged;
  }, [stack, clearingItems]);

  const stackSlots = useMemo(() => {
    const slotCount = stackLimit;
    const slots: StackSlot[] = Array.from(
      { length: slotCount },
      (_, slotIndex) => ({
        slotIndex,
        item: null,
      }),
    );

    displayStack.forEach((item, index) => {
      const slotIndex = slotCount - displayStack.length + index;
      if (slotIndex >= 0 && slotIndex < slotCount) {
        slots[slotIndex] = {
          slotIndex,
          item,
        };
      }
    });

    return slots;
  }, [displayStack, stackLimit]);

  const stackTopId = stack[0]?.id;

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
        border transition-all duration-300 flex flex-col min-h-0
        ${getContainerStyles()}
        ${isShaking ? "animate-shake" : ""}
        ${className}
      `}
    >
      {/* Header */}
      <div className="border-b border-secondary bg-base-300 px-4 py-2 font-mono text-sm flex items-center justify-between">
        <span
          className={`flex items-center gap-2 ${isOverflow ? "text-error font-bold" : ""}`}
        >
          STACK
          <span
            className={`
              px-2 py-0.5 text-xs 
              ${
                isOverflow
                  ? "bg-error text-error-content"
                  : isNearOverflow
                    ? "bg-warning/20 text-warning"
                    : "bg-base-200"
              }
            `}
          >
            {stackSize}/{stackLimit}
          </span>
        </span>
        <div className="flex items-center gap-2">
          {memoryLeakActive && (
            <span
              className="text-warning text-xs animate-pulse glitch-text"
              data-text="[LEAK]"
            >
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
      <div className="relative p-2 flex flex-1 flex-col min-h-0 overflow-hidden">
        <div
          aria-hidden="true"
          className={`stack-drop-lane stack-lane-flow pointer-events-none absolute top-8 bottom-6 right-3 w-1 ${
            laneFlashActive ? "stack-lane-flash" : ""
          }`}
          style={
            {
              "--stack-lane-duration": `${laneFlowDurationMs}ms`,
            } as React.CSSProperties
          }
        />
        {lineClearActive && (
          <div
            aria-hidden="true"
            className="stack-line-clear pointer-events-none absolute inset-x-2 top-8 bottom-4"
            style={
              {
                "--stack-clear-duration": `${computedClearDurationMs}ms`,
              } as React.CSSProperties
            }
          />
        )}

        <div className="relative z-10 flex flex-1 flex-col gap-2 min-h-0">
          {/* Capacity bar */}
          <div className="h-1 bg-base-300 mb-2 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                isOverflow
                  ? "bg-error"
                  : isNearOverflow
                    ? "bg-warning"
                    : "bg-success"
              }`}
              style={{
                width: `${Math.min(100, (stackSize / stackLimit) * 100)}%`,
              }}
            />
          </div>

          <div className="flex flex-1 flex-col gap-2 min-h-0 justify-end">
            <div
              className="relative grid flex-1 content-end gap-2"
              style={{
                minHeight: `${stackMinHeight}px`,
                gridAutoRows: `${stackRowHeight}px`,
              }}
            >
              {stack.length === 0 && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-muted font-mono text-sm">
                  Stack empty
                </div>
              )}

              {stackSlots.map((slot) => {
                if (!slot.item) {
                  return (
                    <div
                      key={`slot-empty-${slot.slotIndex}`}
                      className="border border-dashed border-secondary/40 bg-base-200/10"
                      aria-hidden="true"
                    />
                  );
                }

                const item = slot.item;
                const isActive = item.state === "active";
                const isNew = isActive && newProblemIds.has(item.problem.id);
                const isClearing = item.state === "clearing";
                const fallDelayMs = isNew ? item.index * fallStaggerMs : 0;
                const fallOffset = -Math.max(
                  stackRowHeight,
                  slot.slotIndex * stackRowStep,
                );

                const itemStyle = {
                  ...(isNew
                    ? {
                        "--stack-fall-duration": `${computedFallDurationMs}ms`,
                        "--stack-fall-delay": `${fallDelayMs}ms`,
                        "--stack-fall-offset": `${fallOffset}px`,
                      }
                    : {}),
                  ...(isClearing
                    ? {
                        "--stack-clear-duration": `${computedClearDurationMs}ms`,
                      }
                    : {}),
                } as React.CSSProperties;

                return (
                  <div
                    key={item.key}
                    className={`
                      relative flex items-center gap-2 p-2 border border-secondary
                      gpu-accelerated overflow-hidden
                      ${isNew ? "stack-fall" : ""}
                      ${isClearing ? "stack-clear" : ""}
                      ${item.problem.isGarbage ? "striped-pattern opacity-80 stack-garbage" : ""}
                      ${isActive && stackTopId === item.problem.id ? "ring-1 ring-primary/30" : ""}
                      transition-all duration-200 hover:border-primary/50
                    `}
                    style={itemStyle}
                  >
                    {isNew && (
                      <span className="stack-impact-line" aria-hidden="true" />
                    )}
                    {isClearing && (
                      <span className="stack-clear-spark" aria-hidden="true" />
                    )}

                    {/* Position indicator */}
                    <span className="text-muted text-xs font-mono w-4">
                      {item.index + 1}
                    </span>

                    {/* Difficulty bar */}
                    <div
                      className={`w-1 h-8 ${getDifficultyStyles(item.problem.difficulty)} ${
                        isNew ? "animate-glow-pulse" : ""
                      }`}
                    />

                    {/* Problem title */}
                    <span className="font-mono text-xs flex-1 truncate">
                      {item.problem.title}
                      {item.problem.isGarbage && (
                        <span className="ml-2 text-muted text-[10px]">
                          [GARBAGE]
                        </span>
                      )}
                    </span>

                    {/* Difficulty badge */}
                    <span
                      className={`text-[10px] font-mono px-1 ${
                        item.problem.difficulty === "easy"
                          ? "text-success"
                          : item.problem.difficulty === "medium"
                            ? "text-warning"
                            : "text-error"
                      }`}
                    >
                      {item.problem.difficulty.charAt(0).toUpperCase()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
