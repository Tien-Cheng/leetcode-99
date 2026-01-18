"use client";

import React from "react";

export interface JoinModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPlayer: () => void;
  onSelectSpectator: () => void;
  roomFull?: boolean;
}

/**
 * Modal for selecting join mode (Player or Spectator) when joining an active match
 */
export function JoinModeModal({
  isOpen,
  onClose,
  onSelectPlayer,
  onSelectSpectator,
  roomFull = false,
}: JoinModeModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-base-200 border border-primary p-6 w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-mono text-primary text-lg">MATCH IN PROGRESS</h2>
          <button
            onClick={onClose}
            className="font-mono text-xs text-muted hover:text-base-content"
          >
            [Esc] Close
          </button>
        </div>

        {/* Message */}
        <p className="font-mono text-sm text-base-content mb-6">
          The match has already started. Choose how you&apos;d like to join:
        </p>

        {/* Options */}
        <div className="space-y-3 mb-6">
          <button
            onClick={onSelectPlayer}
            disabled={roomFull}
            className={`w-full px-4 py-3 border font-mono text-left transition-all ${
              roomFull
                ? "border-secondary bg-base-300/50 text-muted cursor-not-allowed"
                : "border-secondary hover:border-primary hover:bg-primary/5 focus:border-primary focus:outline-none"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-base-content font-bold">
                  Join as Player
                </div>
                <div className="text-xs text-muted mt-1">
                  {roomFull
                    ? "Room is full - cannot join as player"
                    : "Jump into the match and start coding"}
                </div>
              </div>
              {!roomFull && <span className="text-primary">→</span>}
            </div>
          </button>

          <button
            onClick={onSelectSpectator}
            className="w-full px-4 py-3 border border-secondary hover:border-primary hover:bg-primary/5 focus:border-primary focus:outline-none font-mono text-left transition-all"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-base-content font-bold">
                  Join as Spectator
                </div>
                <div className="text-xs text-muted mt-1">
                  Watch the action without participating
                </div>
              </div>
              <span className="text-primary">→</span>
            </div>
          </button>
        </div>

        {/* Footer hint */}
        <div className="border-t border-secondary pt-4">
          <p className="text-xs text-muted font-mono">
            Tip: You can change your role in the lobby before the match starts
          </p>
        </div>
      </div>
    </div>
  );
}
