import React, { useEffect, useState } from "react";

export interface MinimapPlayer {
  id: string;
  username: string;
  status: "coding" | "error" | "underAttack" | "eliminated";
  isBot?: boolean;
  isTyping?: boolean;
  lastScoreChange?: { value: number; at: number };
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
 * Enhanced with typing indicators, score changes, and elimination effects
 */
export function Minimap({
  players,
  selfId,
  targetId,
  spectatingId,
  onPlayerClick,
  className = "",
}: MinimapProps) {
  const [recentEliminations, setRecentEliminations] = useState<Set<string>>(new Set());

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

  const getStatusIcon = (status: MinimapPlayer["status"]) => {
    switch (status) {
      case "coding":
        return null;
      case "error":
        return <span className="absolute -top-1 -right-1 text-[8px]">⚠</span>;
      case "underAttack":
        return <span className="absolute -top-1 -right-1 text-[8px] animate-pulse">⚔</span>;
      case "eliminated":
        return <span className="absolute -top-1 -right-1 text-[8px]">☠</span>;
      default:
        return null;
    }
  };

  const getAbbreviation = (username: string) => {
    return username.slice(0, 2).toLowerCase();
  };

  return (
    <div className={`grid grid-cols-4 gap-1 ${className}`}>
      {players.map((player) => {
        const isSelf = player.id === selfId;
        const isTarget = player.id === targetId;
        const isSpectating = player.id === spectatingId;
        const isEliminated = player.status === "eliminated";
        const hasScoreChange = player.lastScoreChange &&
          Date.now() - player.lastScoreChange.at < 2000;

        return (
          <button
            key={player.id}
            onClick={() => !isEliminated && onPlayerClick?.(player.id)}
            disabled={isEliminated}
            className={`
              aspect-square flex items-center justify-center relative
              border text-xs font-mono
              ${getStatusStyles(player)}
              ${isSelf ? "border-primary glow-primary border-2" : ""}
              ${isTarget ? "ring-2 ring-accent ring-offset-1 ring-offset-base-100" : ""}
              ${!isEliminated && onPlayerClick ? "hover:border-primary/50 cursor-pointer hover:scale-105" : "cursor-default"}
              ${isEliminated ? "line-through" : ""}
              transition-all duration-150
            `}
            title={`${player.username}${player.isBot ? " (Bot)" : ""}${isSelf ? " (You)" : ""}${isEliminated ? " [ELIMINATED]" : ""}`}
          >
            {/* Status icon */}
            {getStatusIcon(player.status)}

            {/* Spectating indicator */}
            {isSpectating && <span className="absolute -top-1 -left-1 text-[10px] text-primary">👁</span>}

            {/* Score change indicator */}
            {hasScoreChange && player.lastScoreChange && (
              <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-[8px] text-success animate-fly-up font-bold">
                +{player.lastScoreChange.value}
              </span>
            )}

            {/* Target indicator */}
            {isTarget && !isSpectating && (
              <span className="absolute -top-1 -right-1 text-[10px] text-accent animate-pulse">⊕</span>
            )}

            {/* Bot indicator */}
            {player.isBot && (
              <span className="absolute -bottom-1 -right-1 text-[6px] text-warning">🤖</span>
            )}

            {/* Username abbreviation */}
            <span className={isSelf ? "font-bold" : ""}>
              {getAbbreviation(player.username)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
