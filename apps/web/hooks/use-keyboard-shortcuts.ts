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
        const isInput =
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target instanceof HTMLSelectElement ||
          target.isContentEditable ||
          target.closest(".monaco-editor");

        if (isInput) {
          // Allow shortcuts with modifiers (Alt, Ctrl, Meta) or special keys like Escape
          // to bypass the focus check. This ensures Alt+R and Ctrl+Shift+2 work while typing code.
          const hasModifier = e.altKey || e.ctrlKey || e.metaKey;
          if (e.key !== "Escape" && !hasModifier) {
            return;
          }
        }
      }

      // Debug logging for Ctrl+Shift+number combinations
      if (e.ctrlKey && e.shiftKey && /^\d$/.test(e.key)) {
        console.log("[Shortcut] Detected Ctrl+Shift+" + e.key, {
          key: e.key,
          code: e.code,
          ctrlKey: e.ctrlKey,
          shiftKey: e.shiftKey,
          altKey: e.altKey,
          metaKey: e.metaKey,
          target: e.target,
        });
      }

      // Find matching shortcut
      const matchingShortcut = shortcuts.find((shortcut) => {
        // Special handling for Mac: Option+[Key] often changes e.key to a special character.
        // We check e.code to be sure it's the right physical key.
        // For letters: e.code = "KeyA", "KeyB", etc.
        // For numbers: e.code = "Digit1", "Digit2", etc.
        const isNumber = /^\d$/.test(shortcut.key);
        const keyMatches =
          shortcut.key.toLowerCase() === e.key.toLowerCase() ||
          (shortcut.key.length === 1 && !isNumber && e.code === `Key${shortcut.key.toUpperCase()}`) ||
          (shortcut.key.length === 1 && isNumber && e.code === `Digit${shortcut.key}`);

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
        console.log("[Shortcut] Matched shortcut:", matchingShortcut.description || matchingShortcut.key);
        e.preventDefault();
        matchingShortcut.action();
      } else if (e.ctrlKey && e.shiftKey && /^\d$/.test(e.key)) {
        // Debug why Ctrl+Shift+number didn't match
        console.log("[Shortcut] Ctrl+Shift+" + e.key + " pressed but no match found. Available shortcuts:", 
          shortcuts.filter(s => s.ctrlKey && s.shiftKey).map(s => ({
            key: s.key,
            ctrlKey: s.ctrlKey,
            shiftKey: s.shiftKey,
            altKey: s.altKey,
            metaKey: s.metaKey,
            description: s.description
          }))
        );
      }
    },
    [shortcuts, enabled, disableWhenInputFocused]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [handleKeyPress]);
}
