import React, { useEffect } from "react";

export interface ShopItem {
  id: string;
  name: string;
  cost: number;
  description?: string;
  cooldownRemaining?: number;
  isDisabled?: boolean;
  hotkey: string;
}

export interface ShopModalProps {
  isOpen: boolean;
  score: number;
  items: ShopItem[];
  onPurchase: (itemId: string) => void;
  onClose: () => void;
}

/**
 * Shop Modal component - overlay for purchasing power-ups
 * Keyboard shortcuts 1-5 for quick purchase
 */
export function ShopModal({
  isOpen,
  score,
  items,
  onPurchase,
  onClose,
}: ShopModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      // Number keys 1-5 for quick purchase
      const num = parseInt(e.key);
      if (num >= 1 && num <= items.length) {
        const item = items[num - 1];
        if (item && !item.isDisabled && score >= item.cost && !item.cooldownRemaining) {
          onPurchase(item.id);
        }
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [isOpen, items, score, onPurchase, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-base-200 border border-primary p-6 w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-secondary">
          <h2 className="font-mono text-xl text-primary">SHOP</h2>
          <button
            onClick={onClose}
            className="font-mono text-sm text-muted hover:text-base-content"
          >
            [Esc] Close
          </button>
        </div>

        {/* Score Display */}
        <div className="mb-4 font-mono text-sm">
          Your Score: <span className="text-accent">{score}</span>
        </div>

        {/* Items */}
        <div className="space-y-2">
          {items.map((item, index) => {
            const canAfford = score >= item.cost;
            const isAvailable = !item.isDisabled && !item.cooldownRemaining;
            const isEnabled = canAfford && isAvailable;

            return (
              <button
                key={item.id}
                onClick={() => isEnabled && onPurchase(item.id)}
                disabled={!isEnabled}
                className={`
                  w-full text-left px-3 py-2 border font-mono text-sm
                  transition-all duration-100
                  ${isEnabled
                    ? "border-primary hover:bg-primary/10 cursor-pointer"
                    : "border-secondary opacity-50 cursor-not-allowed"
                  }
                `}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-primary">[{item.hotkey}]</span>
                    <span>{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.cooldownRemaining ? (
                      <span className="text-warning text-xs">
                        ({item.cooldownRemaining}s)
                      </span>
                    ) : null}
                    <span
                      className={canAfford ? "text-accent" : "text-error"}
                    >
                      {item.cost} pts
                    </span>
                  </div>
                </div>
                {item.description && (
                  <div className="text-xs text-muted mt-1">
                    {item.description}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Footer hint */}
        <div className="mt-4 pt-2 border-t border-secondary text-xs text-muted font-mono">
          Press number keys [1-{items.length}] to quick-buy
        </div>
      </div>
    </div>
  );
}
