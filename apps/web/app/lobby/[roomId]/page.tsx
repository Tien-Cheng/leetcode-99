"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button, Panel, Tile } from "@leet99/ui";

export default function LobbyPage() {
  const router = useRouter();
  const params = useParams();
  const roomId = params.roomId as string;
  const [copied, setCopied] = useState(false);
  const [isHost, setIsHost] = useState(true); // TODO: Get from room state

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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case "b":
          if (isHost) {
            // TODO: Add bot
            alert("Add bot functionality coming soon!");
          }
          break;
        case "s":
          if (isHost) {
            // TODO: Start match
            router.push(`/game/${roomId}`);
          }
          break;
        case "escape":
          handleLeaveRoom();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [isHost, router, roomId]);

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
          <Panel title="Players (2/8)">
            <div className="grid grid-cols-4 gap-3">
              <Tile variant="self" username="alice" isHost={true} />
              <Tile variant="player" username="bob" />
              <Tile variant="bot" username="Bot 1" botDifficulty="medium" onRemove={() => alert("Remove bot")} />
              <Tile variant="empty" />
              <Tile variant="empty" />
              <Tile variant="empty" />
              <Tile variant="empty" />
              <Tile variant="empty" />
            </div>
          </Panel>

          {/* Settings */}
          <Panel title={isHost ? "Settings (Host Only)" : "Settings"}>
            <div className="space-y-3">
              {isHost ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm text-muted">Duration:</span>
                    <select
                      className="px-2 py-1 bg-base-200 border border-secondary font-mono text-sm"
                      defaultValue="10 min"
                    >
                      <option>6 min</option>
                      <option>8 min</option>
                      <option>10 min</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm text-muted">Difficulty:</span>
                    <select
                      className="px-2 py-1 bg-base-200 border border-secondary font-mono text-sm"
                      defaultValue="Moderate"
                    >
                      <option>Beginner</option>
                      <option>Moderate</option>
                      <option>Competitive</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm text-muted">Attack Intensity:</span>
                    <select
                      className="px-2 py-1 bg-base-200 border border-secondary font-mono text-sm"
                      defaultValue="Low"
                    >
                      <option>Low</option>
                      <option>High</option>
                    </select>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm text-muted">Duration:</span>
                    <span className="font-mono text-sm">10 min</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm text-muted">Difficulty:</span>
                    <span className="font-mono text-sm">Moderate</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm text-muted">Attack Intensity:</span>
                    <span className="font-mono text-sm">Low</span>
                  </div>
                </>
              )}
            </div>
          </Panel>

          {/* Host Actions */}
          {isHost && (
            <div className="flex gap-3">
              <Button variant="secondary" hotkey="B" onClick={() => alert("Add bot coming soon!")}>
                Add Bot
              </Button>
              <Button variant="primary" hotkey="S" onClick={() => router.push(`/game/${roomId}`)}>
                Start Match
              </Button>
            </div>
          )}
        </div>

        {/* Right: Chat */}
        <div className="w-96">
          <Panel title="CHAT" className="h-full flex flex-col">
            <div className="flex-1 overflow-y-auto space-y-1 font-mono text-sm mb-4">
              <div className="text-muted">&gt; alice joined</div>
              <div className="text-muted">&gt; bob joined</div>
              <div className="text-muted">&gt; Host added Bot 1</div>
              <div className="text-base-content">&gt; Welcome to the lobby!</div>
            </div>
            <input
              type="text"
              placeholder="Enter message..."
              className="w-full px-3 py-2 bg-base-200 border border-secondary font-mono text-sm focus:border-primary focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  // TODO: Send chat message
                  alert("Chat coming soon!");
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
