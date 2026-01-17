"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { GameStateProvider } from "../../../contexts/game-state-context";
import { Button, Panel } from "@leet99/ui";

interface SpectateWrapperProps {
  children: ReactNode;
  roomId: string;
}

export function SpectateWrapper({ children, roomId }: SpectateWrapperProps) {
  const router = useRouter();
  const [connectionReady, setConnectionReady] = useState(false);
  const [wsUrl, setWsUrl] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [playerToken, setPlayerToken] = useState("");
  const [missingAuth, setMissingAuth] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(`room_${roomId}`);
    if (!stored) {
      setMissingAuth(true);
      setConnectionReady(true);
      return;
    }

    try {
      const auth = JSON.parse(stored) as {
        playerId: string;
        playerToken: string;
        wsUrl?: string;
      };
      setPlayerId(auth.playerId);
      setPlayerToken(auth.playerToken);

      const partyHost =
        process.env.NEXT_PUBLIC_PARTYKIT_HOST || "127.0.0.1:1999";
      const partyName =
        process.env.NEXT_PUBLIC_PARTYKIT_PARTY ||
        process.env.NEXT_PUBLIC_PARTYKIT_PROJECT ||
        "leet99";
      const hostUrl = partyHost.startsWith("http") ? new URL(partyHost) : null;
      const wsProtocol = hostUrl
        ? hostUrl.protocol === "https:"
          ? "wss"
          : "ws"
        : window.location.protocol === "https:"
          ? "wss"
          : "ws";
      const wsHost = hostUrl ? hostUrl.host : partyHost;
      const fallbackUrl = `${wsProtocol}://${wsHost}/parties/${partyName}/${roomId}`;

      let finalUrl = auth.wsUrl || fallbackUrl;
      if (finalUrl.includes("localhost")) {
        finalUrl = finalUrl.replace("localhost", "127.0.0.1");
      }
      setWsUrl(finalUrl);
      setConnectionReady(true);
    } catch (error) {
      console.error("Failed to parse stored auth", error);
      setMissingAuth(true);
      setConnectionReady(true);
    }
  }, [roomId]);

  if (!connectionReady) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="font-mono text-muted">Connecting...</div>
      </div>
    );
  }

  if (missingAuth || !playerToken) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <Panel title="SPECTATOR" className="max-w-md w-full">
          <div className="space-y-4 text-sm text-base-content">
            <p className="font-mono">
              Missing room credentials. Join the room to spectate this match.
            </p>
            <Button
              variant="primary"
              onClick={() => router.push(`/join/${roomId}`)}
            >
              Join Room
            </Button>
          </div>
        </Panel>
      </main>
    );
  }

  return (
    <GameStateProvider
      wsUrl={wsUrl}
      playerId={playerId}
      playerToken={playerToken}
    >
      {children}
    </GameStateProvider>
  );
}
