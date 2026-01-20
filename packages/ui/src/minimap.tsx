import React, { useEffect, useState } from "react";

export interface MinimapPlayer {
  id: string;
  username: string;
  status: "coding" | "error" | "underAttack" | "eliminated";
  isBot?: boolean;
  isTyping?: boolean;
  lastScoreChange?: { value: number; at: number };
  score?: number;
  stackSize?: number;
  activeDebuff?: { type: string; endsAt: string } | null;
}

export interface MinimapProps {
  players: MinimapPlayer[];
  selfId: string;
  targetId?: string;
  spectatingId?: string;
  stackLimit?: number;
  onPlayerClick?: (playerId: string) => void;
  className?: string;
}

/**
 * Minimap component - compact grid showing player statuses
 * Enhanced with score bars, debuff indicators, and elimination effects
 */
export function Minimap({
  players,
  selfId,
  targetId,
  stackLimit,
  onPlayerClick,
  className = "",
}: MinimapProps) {
  const [recentEliminations, setRecentEliminations] = useState<Set<string>>(
    new Set(),
  );
  const playerCount = players.length;
  const density =
    playerCount <= 16 ? "large" : playerCount <= 49 ? "medium" : "micro";

  const gridRowsClass =
    density === "large"
      ? "grid-rows-4"
      : density === "medium"
        ? "grid-rows-7"
        : "grid-rows-9";
  const gapClass = density === "micro" ? "gap-1" : "gap-1.5";
  const scrollClass =
    density === "large"
      ? "max-h-[240px]"
      : density === "medium"
        ? "max-h-[320px]"
        : "max-h-[360px]";
  const tilePaddingClass =
    density === "large"
      ? "p-1.5 min-h-[44px]"
      : density === "medium"
        ? "p-1 min-h-[32px]"
        : "p-0.5 min-h-[24px]";
  const textSizeClass =
    density === "micro"
      ? "text-[8px]"
      : density === "medium"
        ? "text-[9px]"
        : "text-[10px]";
  const barHeightClass = density === "micro" ? "h-1" : "h-2";
  const minBarWidth = density === "micro" ? 4 : 8;
  const showScoreNumber = density === "large";
  const showScoreDot = density === "medium";

  const maxScore = Math.max(...players.map((p) => p.score || 0), 1);
  const maxStack = Math.max(...players.map((p) => p.stackSize || 0), 1);

  // Track eliminations for explosion effect
  useEffect(() => {
    const eliminated = players
      .filter((p) => p.status === "eliminated")
      .map((p) => p.id);
    const newEliminations = eliminated.filter(
      (id) => !recentEliminations.has(id),
    );

    if (newEliminations.length > 0) {
      setRecentEliminations((prev) => new Set([...prev, ...newEliminations]));

      // Clear explosion effect after animation
      setTimeout(() => {
        setRecentEliminations((prev) => {
          const next = new Set(prev);
          newEliminations.forEach((id) => next.delete(id));
          return next;
        });
      }, 500);
    }
  }, [players, recentEliminations]);

  const getStatusStyles = (player: MinimapPlayer) => {
    const isExploding = recentEliminations.has(player.id);
    const hasDebuff = player.activeDebuff != null;

    // Special styling when under debuff
    if (hasDebuff && player.status !== "eliminated") {
      const debuffType = player.activeDebuff?.type;
      switch (debuffType) {
        case "ddos":
          return "border-error bg-error/20 animate-pulse-red";
        case "flashbang":
          return "border-warning bg-warning/30 animate-pulse";
        case "vimLock":
          return "border-success bg-success/20 vim-cursor-blink";
        case "memoryLeak":
          return "border-warning bg-warning/20 glitch-text";
        default:
          return "border-warning bg-warning/20 animate-shake";
      }
    }

    switch (player.status) {
      case "coding":
        return `border-success bg-success/10 ${player.isTyping ? "animate-typing" : ""}`;
      case "error":
        return "border-error bg-error/10 animate-pulse";
      case "underAttack":
        return "border-warning bg-warning/20 animate-shake";
      case "eliminated":
        return `border-secondary/50 bg-base-300 opacity-50 ${isExploding ? "animate-explosion" : ""}`;
      default:
        return "border-secondary";
    }
  };

  const getBotLabel = (username: string) => {
    const match = username.match(/\d+/g)?.[0];
    return match ? `B${match}` : "BOT";
  };

  const getDisplayLabel = (player: MinimapPlayer) => {
    if (player.isBot) {
      return getBotLabel(player.username);
    }

    if (density === "large") {
      const trimmed = player.username.slice(0, 12);
      return player.username.length > 12 ? `${trimmed}…` : trimmed;
    }

    if (density === "medium") {
      const trimmed = player.username.slice(0, 6).toUpperCase();
      return player.username.length > 6 ? `${trimmed}…` : trimmed;
    }

    return player.username.slice(0, 2).toUpperCase();
  };

  const getPressureBarColor = (
    player: MinimapPlayer,
    isSelf: boolean,
    stackRatio: number,
  ) => {
    if (player.status === "eliminated") return "bg-secondary/30";
    if (stackRatio >= 0.8) return "bg-error";
    if (stackRatio >= 0.6) return "bg-warning";
    if (player.activeDebuff) return "bg-warning";
    if (isSelf) return "bg-primary";
    return "bg-success";
  };

  return (
    <div
      className={`grid grid-flow-col auto-cols-fr ${gridRowsClass} ${gapClass} ${scrollClass} overflow-y-auto pr-1 ${className}`}
    >
      {players.map((player) => {
        const isSelf = player.id === selfId;
        const isTarget = player.id === targetId;

        const isEliminated = player.status === "eliminated";
        const hasScoreChange =
          player.lastScoreChange &&
          Date.now() - player.lastScoreChange.at < 2000;
        const stackSize = player.stackSize ?? 0;
        const stackRatio =
          stackLimit && stackLimit > 0
            ? stackSize / stackLimit
            : stackSize / maxStack;
        const stackPercent = Math.min(stackRatio, 1) * 100;
        const stackWidth =
          stackPercent === 0 ? 0 : Math.max(stackPercent, minBarWidth);
        const scoreRatio = maxScore > 0 ? (player.score || 0) / maxScore : 0;
        const scoreOpacity = Math.min(Math.max(scoreRatio, 0), 1);

        return (
          <button
            key={player.id}
            onClick={() => !isEliminated && onPlayerClick?.(player.id)}
            disabled={isEliminated}
            className={`
              flex flex-col items-center justify-center relative border font-mono
              ${tilePaddingClass} ${textSizeClass}
              ${getStatusStyles(player)}
              ${isSelf ? "border-primary glow-primary border-2" : ""}
              ${isTarget ? "ring-2 ring-accent ring-offset-1 ring-offset-base-100" : ""}
              ${!isEliminated && onPlayerClick ? "hover:border-primary/50 cursor-pointer hover:scale-105" : "cursor-default"}
              ${isEliminated ? "line-through" : ""}
              transition-all duration-150
            `}
            title={`${player.username}${player.isBot ? " (Bot)" : ""}${isSelf ? " (You)" : ""}${isEliminated ? " [ELIMINATED]" : ""} · Stack: ${stackSize}${stackLimit ? `/${stackLimit}` : ""} · Score: ${player.score || 0}${player.activeDebuff ? ` [${player.activeDebuff.type.toUpperCase()}]` : ""}`}
          >
            {/* Score change indicator */}
            {hasScoreChange && player.lastScoreChange && (
              <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-[8px] text-success animate-fly-up font-bold z-10">
                +{player.lastScoreChange.value}
              </span>
            )}

            {/* Username label */}
            <span
              className={`${isSelf ? "font-bold" : ""} ${density === "large" ? "max-w-full truncate" : ""}`}
            >
              {getDisplayLabel(player)}
            </span>

            {showScoreDot && (
              <span
                className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary"
                style={{ opacity: scoreOpacity }}
              />
            )}

            {/* Stack pressure bar */}
            <div
              className={`w-full ${barHeightClass} bg-secondary/50 overflow-hidden ${density === "micro" ? "" : "rounded-sm"} mt-0.5`}
            >
              <div
                className={`h-full transition-all duration-300 ${getPressureBarColor(player, isSelf, stackRatio)}`}
                style={{ width: `${stackWidth}%` }}
              />
            </div>

            {showScoreNumber && (
              <span className="text-[8px] text-base-content/70 mt-0.5">
                {player.score || 0}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
