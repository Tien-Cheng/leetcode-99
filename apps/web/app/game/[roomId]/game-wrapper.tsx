"use client";

import { useState, useEffect, type ReactNode } from "react";
import { GameStateProvider } from "../../../contexts/game-state-context";
import { HotkeyProvider } from "../../../components/hotkey-provider";

interface GameWrapperProps {
  children: ReactNode;
  roomId: string;
}

/**
 * Wrapper that provides game state context with auth/connection details
 * For MVP, we're using mock credentials - in production this would come from auth
 */
export function GameWrapper({ children, roomId }: GameWrapperProps) {
  const [connectionReady, setConnectionReady] = useState(false);
  const [wsUrl, setWsUrl] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [playerToken, setPlayerToken] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem(`room_${roomId}`);
    if (stored) {
      try {
        const auth = JSON.parse(stored);
        setPlayerId(auth.playerId);
        setPlayerToken(auth.playerToken);
        // Use stored wsUrl or fallback
        const url = auth.wsUrl || process.env.NEXT_PUBLIC_PARTYKIT_HOST
          ? `ws://${process.env.NEXT_PUBLIC_PARTYKIT_HOST || "localhost:1999"}/parties/main/${roomId}`
          : `ws://localhost:1999/parties/main/${roomId}`;

        // If the stored URL is from server, it might be fully qualified. 
        // CreateRoom returns full wsUrl.
        setWsUrl(auth.wsUrl || url);
        setConnectionReady(true);
      } catch (e) {
        console.error("Failed to parse stored auth", e);
      }
    } else {
      // Redirect or show error?
      // For now, let it hang or show message, as redirecting might cause loop if not handled
      console.warn("No stored auth found for room", roomId);
    }
  }, [roomId]);

  if (!connectionReady) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="font-mono text-muted">Connecting...</div>
      </div>
    );
  }

  return (
    <HotkeyProvider>
      <GameStateProvider
        wsUrl={wsUrl}
        playerId={playerId}
        playerToken={playerToken}
      >
        {children}
      </GameStateProvider>
    </HotkeyProvider>
  );
}
