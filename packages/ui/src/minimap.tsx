import React, { useEffect, useState } from "react";

export interface MinimapPlayer {
  id: string;
  username: string;
  status: "coding" | "error" | "underAttack" | "eliminated";
  isBot?: boolean;
  isTyping?: boolean;
  lastScoreChange?: { value: number; at: number };
  score?: number;
  activeDebuff?: { type: string; endsAt: string } | null;
}

export interface MinimapProps {
  players: MinimapPlayer[];
  selfId: string;
  targetId?: string;
  spectatingId?: string;
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

  onPlayerClick,
  className = "",
}: MinimapProps) {
  const [recentEliminations, setRecentEliminations] = useState<Set<string>>(new Set());

  // Calculate max score for relative bars
  const maxScore = Math.max(...players.map(p => p.score || 0), 1);

  // Track eliminations for explosion effect
  useEffect(() => {
    const eliminated = players.filter(p => p.status === "eliminated").map(p => p.id);
    const newEliminations = eliminated.filter(id => !recentEliminations.has(id));

    if (newEliminations.length > 0) {
      setRecentEliminations(prev => new Set([...prev, ...newEliminations]));

      // Clear explosion effect after animation
      setTimeout(() => {
        setRecentEliminations(prev => {
          const next = new Set(prev);
          newEliminations.forEach(id => next.delete(id));
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



  const getAbbreviation = (username: string) => {
    return username.slice(0, 2).toLowerCase();
  };

  const getScoreBarColor = (player: MinimapPlayer, isSelf: boolean) => {
    if (player.status === "eliminated") return "bg-secondary/30";
    if (player.activeDebuff) return "bg-warning";
    if (isSelf) return "bg-primary";
    return "bg-success";
  };

  return (
    <div className={`grid grid-cols-4 gap-1.5 ${className}`}>
      {players.map((player) => {
        const isSelf = player.id === selfId;
        const isTarget = player.id === targetId;

        const isEliminated = player.status === "eliminated";
        const hasScoreChange = player.lastScoreChange &&
          Date.now() - player.lastScoreChange.at < 2000;
        const scorePercent = maxScore > 0 ? ((player.score || 0) / maxScore) * 100 : 0;

        return (
          <button
            key={player.id}
            onClick={() => !isEliminated && onPlayerClick?.(player.id)}
            disabled={isEliminated}
            className={`
              flex flex-col items-center justify-center relative p-1
              border text-xs font-mono min-h-[44px]
              ${getStatusStyles(player)}
              ${isSelf ? "border-primary glow-primary border-2" : ""}
              ${isTarget ? "ring-2 ring-accent ring-offset-1 ring-offset-base-100" : ""}
              ${!isEliminated && onPlayerClick ? "hover:border-primary/50 cursor-pointer hover:scale-105" : "cursor-default"}
              ${isEliminated ? "line-through" : ""}
              transition-all duration-150
            `}
            title={`${player.username}${player.isBot ? " (Bot)" : ""}${isSelf ? " (You)" : ""} - Score: ${player.score || 0}${player.activeDebuff ? ` [${player.activeDebuff.type.toUpperCase()}]` : ""}${isEliminated ? " [ELIMINATED]" : ""}`}
          >

            {/* Score change indicator */}
            {hasScoreChange && player.lastScoreChange && (
              <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-[8px] text-success animate-fly-up font-bold z-10">
                +{player.lastScoreChange.value}
              </span>
            )}


            {/* Username abbreviation and score */}
            <span className={`${isSelf ? "font-bold" : ""} text-[10px]`}>
              {getAbbreviation(player.username)}
            </span>

            {/* Score bar */}
            <div className="w-full h-2 bg-secondary/50 rounded-sm overflow-hidden mt-0.5">
              <div
                className={`h-full transition-all duration-300 ${getScoreBarColor(player, isSelf)}`}
                style={{ width: `${Math.max(scorePercent, 8)}%` }}
              />
            </div>

            {/* Score number */}
            <span className="text-[8px] text-base-content/70 mt-0.5">
              {player.score || 0}
            </span>
          </button>
        );
      })}
    </div>
  );
}
