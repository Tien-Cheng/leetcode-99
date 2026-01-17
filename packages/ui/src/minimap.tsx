import React from "react";

export interface MinimapPlayer {
  id: string;
  username: string;
  status: "coding" | "error" | "underAttack" | "eliminated";
  isBot?: boolean;
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
 * Color-coded tiles with 2-char abbreviations
 */
export function Minimap({
  players,
  selfId,
  targetId,
  spectatingId,
  onPlayerClick,
  className = "",
}: MinimapProps) {
  const getStatusColor = (status: MinimapPlayer["status"]) => {
    switch (status) {
      case "coding":
        return "border-success bg-success/10";
      case "error":
        return "border-error bg-error/10";
      case "underAttack":
        return "border-warning bg-warning/10 animate-pulse-amber";
      case "eliminated":
        return "border-secondary/50 bg-base-300 opacity-50";
      default:
        return "border-secondary";
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

        return (
          <button
            key={player.id}
            onClick={() => !isEliminated && onPlayerClick?.(player.id)}
            disabled={isEliminated}
            className={`
              aspect-square flex items-center justify-center
              border text-xs font-mono
              ${getStatusColor(player.status)}
              ${isSelf ? "border-primary glow-primary" : ""}
              ${!isEliminated && onPlayerClick ? "hover:border-primary/50 cursor-pointer" : "cursor-default"}
              ${isEliminated ? "line-through" : ""}
              transition-all duration-100
            `}
            title={`${player.username}${player.isBot ? " (Bot)" : ""}${isSelf ? " (You)" : ""}`}
          >
            {isSpectating && <span className="mr-1">▶</span>}
            {isTarget && !isSpectating && <span className="absolute top-0 right-0 text-[8px]">⊕</span>}
            {getAbbreviation(player.username)}
          </button>
        );
      })}
    </div>
  );
}
