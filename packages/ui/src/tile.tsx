import React from "react";

export interface TileProps {
  variant?: "self" | "player" | "host" | "bot" | "empty";
  density?: "card" | "compact" | "dense";
  username?: string;
  isHost?: boolean;
  botDifficulty?: "easy" | "medium" | "hard";
  score?: number;
  stackSize?: number;
  stackLimit?: number;
  onRemove?: () => void;
  className?: string;
}

/**
 * Tile component for displaying players in lobby
 * Supports different variants with appropriate styling
 */
export function Tile({
  variant = "player",
  density = "card",
  username,
  isHost = false,
  botDifficulty,
  score = 0,
  stackSize = 0,
  stackLimit = 10,
  onRemove,
  className = "",
}: TileProps) {
  const isDense = density === "dense";
  const isCompact = density === "compact";
  const showStats = !isDense;

  const getBotLabel = (value: string) => {
    const match = value.match(/\d+/g)?.[0];
    return match ? `B${match}` : "BOT";
  };

  const botShortLabel =
    variant === "bot" && username ? getBotLabel(username) : null;

  const displayName = username
    ? isDense
      ? (botShortLabel ?? username.slice(0, 2).toUpperCase())
      : username
    : "";

  const stackPercent =
    stackLimit > 0 ? Math.min((stackSize ?? 0) / stackLimit, 1) * 100 : 0;
  const stackWidth = stackPercent === 0 ? 0 : Math.max(stackPercent, 6);

  const baseStyles = "border relative font-mono text-base-content";
  const layoutStyles = isCompact
    ? "flex items-center justify-between gap-3 px-3 py-2 min-h-[48px]"
    : isDense
      ? "flex flex-col items-center justify-center gap-1 px-2 py-2 min-h-[44px]"
      : "flex flex-col items-center justify-center gap-2 px-4 py-3 min-h-[92px]";

  const nameClass = isDense
    ? "text-[10px]"
    : isCompact
      ? "text-sm"
      : "text-base";

  const variantStyles = {
    self: "border-primary glow-primary bg-base-200",
    player: "border-secondary bg-base-200",
    host: "border-secondary bg-base-200",
    bot: "border-warning bg-base-200",
    empty: "border-dashed-muted bg-transparent",
  };

  const barColor =
    variant === "bot"
      ? "bg-warning"
      : variant === "self"
        ? "bg-primary"
        : "bg-success";

  const statsBlock = showStats ? (
    <div
      className={
        isCompact
          ? "flex items-center gap-2 text-xs text-muted"
          : "flex flex-col items-center w-full text-xs text-muted"
      }
    >
      <div
        className={
          isCompact ? "h-2 w-20 bg-base-300/70" : "h-2 w-full bg-base-300/70"
        }
      >
        <div
          className={`h-full transition-all ${barColor}`}
          style={{ width: `${stackWidth}%` }}
        />
      </div>
      <span>{score}</span>
    </div>
  ) : null;

  const botDetailLabel =
    variant === "bot"
      ? botDifficulty
        ? `(${botDifficulty === "easy" ? "Easy" : botDifficulty === "medium" ? "Med" : "Hard"})`
        : "BOT"
      : null;

  const tooltipLabel = username
    ? `${username}${variant === "bot" ? " (Bot)" : ""}${isHost ? " [HOST]" : ""}`
    : undefined;

  return (
    <div
      className={`relative ${baseStyles} ${layoutStyles} ${variantStyles[variant]} ${className}`}
      title={tooltipLabel}
    >
      {variant === "empty" ? (
        <span className="text-muted font-mono text-sm">empty</span>
      ) : (
        <>
          {isDense && isHost && (
            <span className="absolute top-1 right-1 text-[8px] text-warning">
              H
            </span>
          )}
          <div className={`font-mono ${nameClass} truncate max-w-full`}>
            {displayName}
          </div>
          {!isDense && isHost && (
            <div className="flex items-center gap-1">
              <span className="text-warning text-xs">👑</span>
              <span className="text-xs text-warning font-mono">[HOST]</span>
            </div>
          )}
          {!isDense && botDetailLabel && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-warning font-mono">
                {botDetailLabel}
              </span>
              {onRemove && (
                <button
                  onClick={onRemove}
                  className="text-error hover:text-error/80 text-xs font-mono"
                  aria-label="Remove bot"
                >
                  ✕
                </button>
              )}
            </div>
          )}
          {statsBlock}
        </>
      )}
    </div>
  );
}
