import React from "react";

export interface TileProps {
  variant?: "self" | "player" | "host" | "bot" | "empty";
  username?: string;
  isHost?: boolean;
  botDifficulty?: "easy" | "medium" | "hard";
  onRemove?: () => void;
  className?: string;
}

/**
 * Tile component for displaying players in lobby
 * Supports different variants with appropriate styling
 */
export function Tile({
  variant = "player",
  username,
  isHost = false,
  botDifficulty,
  onRemove,
  className = "",
}: TileProps) {
  const baseStyles = "px-4 py-3 border flex flex-col items-center justify-center min-h-[80px] relative";

  const variantStyles = {
    self: "border-primary glow-primary bg-base-200",
    player: "border-secondary bg-base-200",
    host: "border-secondary bg-base-200",
    bot: "border-warning bg-base-200",
    empty: "border-dashed-muted bg-transparent",
  };

  return (
    <div className={`${baseStyles} ${variantStyles[variant]} ${className}`}>
      {variant === "empty" ? (
        <span className="text-muted font-mono text-sm">empty</span>
      ) : (
        <>
          <div className="font-mono text-base-content">
            {username}
          </div>
          {isHost && (
            <div className="flex items-center gap-1 mt-1">
              <span className="text-warning text-xs">👑</span>
              <span className="text-xs text-warning font-mono">[HOST]</span>
            </div>
          )}
          {variant === "bot" && botDifficulty && (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-warning font-mono">
                ({botDifficulty === "easy" ? "Easy" : botDifficulty === "medium" ? "Med" : "Hard"})
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
        </>
      )}
    </div>
  );
}
