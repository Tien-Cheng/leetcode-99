"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button, Panel, Tile } from "@leet99/ui";
import { useRoom } from "@/hooks/use-room";

export default function LobbyPage() {
  const router = useRouter();
  const params = useParams();
  const roomId = params.roomId as string;
  const [copied, setCopied] = useState(false);

  // Integrate PartyKit
  const {
    snapshot,
    players,
    chat,
    isHost,
    me,
    startMatch,
    addBots,
    sendMessage
  } = useRoom(roomId);

  // Redirect if match started
  useEffect(() => {
    if (snapshot && snapshot.match.phase !== "lobby") {
      router.push(`/game/${roomId}`);
    }
  }, [snapshot, router, roomId]);

  const handleCopyLink = () => {
    const shareUrl = `${window.location.origin}/join/${roomId}`;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLeaveRoom = () => {
    if (isHost) {
      if (confirm("You are the host. Leaving will transfer host to another player. Continue?")) {
        router.push("/");
      }
    } else {
      router.push("/");
    }
  };

  const handleStartMatch = () => {
    // Need at least 2 participants (players + bots)
    const totalParticipants = players.length; // players includes bots in the hook's return
    if (totalParticipants < 2) {
      alert("Need at least 2 participants to start match!");
      return;
    }
    console.log("[LobbyPage] Sending Start Match");
    startMatch();
  };

  const handleAddBot = () => {
    console.log("[LobbyPage] Sending Add Bot");
    addBots(1);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case "b":
          if (isHost) {
            handleAddBot();
          }
          break;
        case "s":
          if (isHost) {
            handleStartMatch();
          }
          break;
        case "escape":
          handleLeaveRoom();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [isHost]); // eslint-disable-line react-hooks/exhaustive-deps

  // Render players grid
  // We want to fill 8 slots.
  // Sort players: me first, then host, then others.
  const sortedPlayers = [...players].sort((a, b) => {
    if (a.playerId === me?.playerId) return -1;
    if (b.playerId === me?.playerId) return 1;
    if (a.isHost) return -1;
    if (b.isHost) return 1;
    return 0;
  });

  const slots = Array(8).fill(null);
  sortedPlayers.forEach((p, i) => {
    if (i < 8) slots[i] = p;
  });

  return (
    <main className="flex min-h-screen flex-col p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h1 className="font-mono text-2xl text-primary">
            Room: <span className="text-accent">{roomId}</span>
          </h1>
          <Button
            variant="secondary"
            onClick={handleCopyLink}
            className="text-sm"
          >
            {copied ? "Copied!" : "Copy Link"}
          </Button>
          <div className="text-sm font-mono text-muted">
            {players.length} / 8 Players
          </div>
        </div>
        <Button variant="ghost" onClick={handleLeaveRoom}>
          Leave Room
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 gap-4">
        {/* Left: Players & Settings */}
        <div className="flex-1 space-y-4">
          {/* Players Grid */}
          <Panel title={`Players (${players.length}/8)`}>
            <div className="grid grid-cols-4 gap-3 bg-base-300/50 p-4 rounded-lg min-h-[300px]">
              {slots.map((p, i) => {
                if (!p) return <Tile key={`empty-${i}`} variant="empty" />;

                const isMe = p.playerId === me?.playerId;
                let variant: "self" | "player" | "bot" | "empty" = "player";
                if (isMe) variant = "self";
                if (p.role === "bot") variant = "bot";

                return (
                  <Tile
                    key={p.playerId}
                    variant={variant}
                    username={p.username}
                    isHost={p.isHost}
                  // onRemove={() => {}} // TODO: Kick functionality
                  />
                );
              })}
            </div>
          </Panel>

          {/* Settings */}
          {snapshot && (
            <Panel title={isHost ? "Settings (Host Only)" : "Settings"}>
              <div className="space-y-3">
                {/*  Display current settings from snapshot.settings */}
                {/*  For now just displaying read-only or controls if host found in original file 
                      I'll implement the read-only view for now to keep it safe 
                  */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="flex flex-col">
                    <span className="text-xs text-muted">Duration</span>
                    <span className="font-mono">
                      {snapshot.match.settings.matchDurationSec < 60
                        ? `${snapshot.match.settings.matchDurationSec} sec`
                        : `${Math.floor(snapshot.match.settings.matchDurationSec / 60)} min`}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-muted">Difficulty</span>
                    <span className="font-mono capitalize">{snapshot.match.settings.difficultyProfile}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-muted">Intensity</span>
                    <span className="font-mono capitalize">{snapshot.match.settings.attackIntensity}</span>
                  </div>
                </div>
              </div>
            </Panel>
          )}

          {/* Host Actions */}
          {isHost && (
            <div className="flex gap-3 mt-4">
              <Button variant="secondary" hotkey="B" onClick={handleAddBot}>
                Add Bot
              </Button>
              <Button
                variant="primary"
                hotkey="S"
                onClick={handleStartMatch}
              >
                Start Match
              </Button>
            </div>
          )}
        </div>

        {/* Right: Chat */}
        <div className="w-96">
          <Panel title="CHAT" className="h-full flex flex-col">
            <div className="flex-1 overflow-y-auto space-y-1 font-mono text-sm mb-4 p-2 bg-base-300/30 rounded">
              {chat.map((msg) => (
                <div key={msg.id} className={`${msg.kind === "system" ? "text-accent italic" : "text-base-content"}`}>
                  {msg.kind === "system" ? (
                    <span>&gt; {msg.text}</span>
                  ) : (
                    <span><span className="text-primary">{msg.fromUsername}:</span> {msg.text}</span>
                  )}
                </div>
              ))}
              {chat.length === 0 && <div className="text-muted italic">No messages yet...</div>}
            </div>
            <input
              type="text"
              placeholder="Enter message..."
              className="w-full px-3 py-2 bg-base-200 border border-secondary font-mono text-sm focus:border-primary focus:outline-none rounded"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  sendMessage(e.currentTarget.value);
                  e.currentTarget.value = "";
                }
              }}
            />
          </Panel>
        </div>
      </div>
    </main>
  );
}
