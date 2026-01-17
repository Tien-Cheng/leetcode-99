import { useEffect, useCallback } from "react";

export interface KeyboardShortcut {
  key: string;
  altKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
  action: () => void;
  description?: string;
}

export interface UseKeyboardShortcutsOptions {
  shortcuts: KeyboardShortcut[];
  enabled?: boolean;
  disableWhenInputFocused?: boolean;
}

/**
 * Hook for registering keyboard shortcuts
 * Handles Alt/Option combos for game actions and prevents conflicts
 */
export function useKeyboardShortcuts({
  shortcuts,
  enabled = true,
  disableWhenInputFocused = true,
}: UseKeyboardShortcutsOptions) {
  const handleKeyPress = useCallback(
    (e: KeyboardEvent) => {
      // Disable shortcuts when disabled
      if (!enabled) return;

      // Disable shortcuts when input is focused (except modal-level shortcuts)
      if (disableWhenInputFocused) {
        const target = e.target as HTMLElement;
        if (
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target instanceof HTMLSelectElement
        ) {
          // Allow Escape to work even in inputs
          if (e.key !== "Escape") {
            return;
          }
        }
      }

      // Find matching shortcut
      const matchingShortcut = shortcuts.find((shortcut) => {
        // Special handling for Mac: Option+[Key] often changes e.key to a special character.
        // We check e.code (e.g., 'KeyR') to be sure it's the right physical key.
        const keyMatches =
          shortcut.key.toLowerCase() === e.key.toLowerCase() ||
          (shortcut.key.length === 1 && e.code === `Key${shortcut.key.toUpperCase()}`);

        const altMatches = shortcut.altKey ? e.altKey : !e.altKey;
        const ctrlMatches = shortcut.ctrlKey ? e.ctrlKey : !e.ctrlKey;
        const shiftMatches = shortcut.shiftKey ? e.shiftKey : !e.shiftKey;

        // On Mac, sometimes people expect Meta (Cmd) instead of Alt.
        // But for consistency with the UI hints, we'll keep it strictly Alt for now,
        // but ensure it's compatible by fixing the key matching above.
        const metaMatches = shortcut.metaKey ? e.metaKey : !e.metaKey;

        return (
          keyMatches &&
          altMatches &&
          ctrlMatches &&
          shiftMatches &&
          metaMatches
        );
      });

      if (matchingShortcut) {
        e.preventDefault();
        matchingShortcut.action();
      }
    },
    [shortcuts, enabled, disableWhenInputFocused]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [handleKeyPress]);
}
