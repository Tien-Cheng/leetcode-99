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
    // TODO: In production, get these from:
    // 1. localStorage (after joining/creating room)
    // 2. Session/cookie
    // 3. Auth provider

    // For now, generate mock values for development
    const mockPlayerId = `player_${Math.random().toString(36).substr(2, 9)}`;
    const mockToken = `token_${Math.random().toString(36).substr(2, 16)}`;
    const mockWsUrl = `ws://localhost:1999/party/${roomId}`;

    setPlayerId(mockPlayerId);
    setPlayerToken(mockToken);
    setWsUrl(mockWsUrl);
    setConnectionReady(true);
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
