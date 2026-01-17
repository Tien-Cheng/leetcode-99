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
    console.log(`[GameWrapper] roomId changed: ${roomId}`);
    const stored = localStorage.getItem(`room_${roomId}`);
    if (stored) {
      try {
        const auth = JSON.parse(stored);
        console.log(`[GameWrapper] Restoring auth for player: ${auth.playerId}`);
        setPlayerId(auth.playerId);
        setPlayerToken(auth.playerToken);
        // Use stored wsUrl or fallback
        const partyHost =
          process.env.NEXT_PUBLIC_PARTYKIT_HOST || "127.0.0.1:1999";
        const partyName =
          process.env.NEXT_PUBLIC_PARTYKIT_PARTY ||
          process.env.NEXT_PUBLIC_PARTYKIT_PROJECT ||
          "leet99";
        const hostUrl = partyHost.startsWith("http")
          ? new URL(partyHost)
          : null;
        const wsProtocol = hostUrl
          ? hostUrl.protocol === "https:"
            ? "wss"
            : "ws"
          : window.location.protocol === "https:"
            ? "wss"
            : "ws";
        const wsHost = hostUrl ? hostUrl.host : partyHost;
        const fallbackUrl = `${wsProtocol}://${wsHost}/parties/${partyName}/${roomId}`;

        // CreateRoom returns full wsUrl. Use it when present, otherwise fallback.
        let finalUrl = auth.wsUrl || fallbackUrl;
        // Fix for potential IPv6 localhost issues
        if (finalUrl.includes("localhost")) {
          finalUrl = finalUrl.replace("localhost", "127.0.0.1");
        }
        setWsUrl(finalUrl);
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
