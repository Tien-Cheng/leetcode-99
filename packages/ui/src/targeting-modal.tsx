import React, { useEffect } from "react";

export interface TargetingItem {
    id: string;
    name: string;
    description?: string;
    hotkey: string;
}

export interface TargetingModalProps {
    isOpen: boolean;
    activeMode: string;
    onSelect: (modeId: any) => void;
    onClose: () => void;
}

/**
 * Targeting Modal component - overlay for selecting attack targets
 * Keyboard shortcuts 1-5 for quick selection
 */
export function TargetingModal({
    isOpen,
    activeMode,
    onSelect,
    onClose,
}: TargetingModalProps) {
    const modes: TargetingItem[] = [
        { id: "random", name: "Random", hotkey: "1", description: "Select a random target" },
        { id: "rankAbove", name: "Rank Above", hotkey: "2", description: "Target the player right above you in ranking" },
        { id: "attackers", name: "Attackers", hotkey: "3", description: "Target people who are attacking you" },
        { id: "topScore", name: "Top Score", hotkey: "4", description: "Target the player with the highest score" },
        { id: "nearDeath", name: "Near Death", hotkey: "5", description: "Target the player closest to stack overflow" },
    ];

    useEffect(() => {
        if (!isOpen) return;

        const handleKeyPress = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                onClose();
                return;
            }

            // Number keys 1-5 for quick selection
            const num = parseInt(e.key);
            if (num >= 1 && num <= modes.length) {
                const mode = modes[num - 1];
                if (mode) {
                    onSelect(mode.id);
                }
            }
        };

        window.addEventListener("keydown", handleKeyPress);
        return () => window.removeEventListener("keydown", handleKeyPress);
    }, [isOpen, modes, onSelect, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-base-200 border border-primary p-6 w-full max-w-md shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-secondary">
                    <h2 className="font-mono text-xl text-primary">TARGETING MODE</h2>
                    <button
                        onClick={onClose}
                        className="font-mono text-sm text-muted hover:text-base-content"
                    >
                        [Esc] Close
                    </button>
                </div>

                {/* Current Mode Info */}
                <div className="mb-4 font-mono text-sm">
                    Select target for your attacks:
                </div>

                {/* Modes */}
                <div className="space-y-2">
                    {modes.map((mode) => {
                        const isActive = activeMode === mode.id;

                        return (
                            <button
                                key={mode.id}
                                onClick={() => {
                                    onSelect(mode.id);
                                }}
                                className={`
                  w-full text-left px-3 py-2 border font-mono text-sm
                  transition-all duration-100
                  ${isActive
                                        ? "border-accent bg-accent/10 border-2"
                                        : "border-secondary hover:border-primary hover:bg-primary/5 cursor-pointer"
                                    }
                `}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="text-primary font-bold">[{mode.hotkey}]</span>
                                        <span className={isActive ? "text-accent font-bold" : ""}>{mode.name}</span>
                                    </div>
                                    {isActive && (
                                        <span className="text-accent text-[10px] bg-accent/20 px-1 border border-accent">
                                            ACTIVE
                                        </span>
                                    )}
                                </div>
                                {mode.description && (
                                    <div className="text-xs text-muted mt-1 italic">
                                        {mode.description}
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Footer hint */}
                <div className="mt-4 pt-2 border-t border-secondary text-xs text-muted font-mono">
                    Press number keys [1-{modes.length}] to select
                </div>
            </div>
        </div>
    );
}
