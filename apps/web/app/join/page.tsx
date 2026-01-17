"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@leet99/ui";
import Link from "next/link";

export default function JoinRoomPage() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const roomCodeRef = useRef<HTMLInputElement>(null);

  // Auto-focus room code input
  useEffect(() => {
    roomCodeRef.current?.focus();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) {
        if (e.key === "Enter") {
          handleSubmit(e as unknown as React.FormEvent);
        }
        return;
      }

      if (e.key === "Escape") {
        router.push("/");
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [router, roomCode, username]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validation
    const trimmedRoomCode = roomCode.trim().toUpperCase();
    const trimmedUsername = username.trim();

    if (!trimmedRoomCode) {
      setError("Room code is required");
      return;
    }
    if (!trimmedUsername) {
      setError("Username is required");
      return;
    }
    if (trimmedUsername.length < 1 || trimmedUsername.length > 16) {
      setError("Username must be 1-16 characters");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`/api/rooms/${trimmedRoomCode}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: trimmedUsername,
          role: "player",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle specific error codes
        const errorCode = data.error?.code;
        switch (errorCode) {
          case "ROOM_NOT_FOUND":
            setError("Room not found");
            break;
          case "ROOM_FULL":
            setError("Room is full");
            break;
          case "USERNAME_TAKEN":
            setError("Username already taken in this room");
            break;
          case "MATCH_ALREADY_STARTED":
            // Prompt to join as spectator
            if (confirm("Match already started. Join as spectator?")) {
              // Retry as spectator
              await joinAsSpectator(trimmedRoomCode, trimmedUsername);
              return;
            }
            setError("Match already in progress");
            break;
          default:
            setError(data.error?.message || "Failed to join room");
        }
        setLoading(false);
        return;
      }

      // Store credentials in localStorage
      localStorage.setItem(
        `room_${data.roomId}`,
        JSON.stringify({
          roomId: data.roomId,
          playerId: data.playerId,
          playerToken: data.playerToken,
          wsUrl: data.wsUrl,
          role: data.role,
        })
      );

      // Navigate based on role
      if (data.role === "spectator") {
        router.push(`/spectate/${data.roomId}`);
      } else {
        router.push(`/lobby/${data.roomId}`);
      }
    } catch (err) {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

  const joinAsSpectator = async (roomId: string, username: string) => {
    try {
      const response = await fetch(`/api/rooms/${roomId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          role: "spectator",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error?.message || "Failed to join as spectator");
        setLoading(false);
        return;
      }

      localStorage.setItem(
        `room_${data.roomId}`,
        JSON.stringify({
          roomId: data.roomId,
          playerId: data.playerId,
          playerToken: data.playerToken,
          wsUrl: data.wsUrl,
          role: "spectator",
        })
      );

      router.push(`/spectate/${data.roomId}`);
    } catch (err) {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="font-mono text-3xl font-bold text-primary">
            JOIN ROOM
          </h1>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            ref={roomCodeRef}
            label="Room Code"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            placeholder="AB12CD"
            maxLength={6}
            disabled={loading}
            mono
          />

          <Input
            label="Your Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter username"
            maxLength={16}
            disabled={loading}
          />

          {/* Error Message */}
          {error && (
            <div className="text-error text-sm font-mono">
              ✗ {error}
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3">
            <Button
              type="submit"
              variant="primary"
              hotkey="Enter"
              className="w-full"
              disabled={loading}
            >
              {loading ? "Joining..." : "Join Room"}
            </Button>

            <Link href="/">
              <Button variant="ghost" hotkey="Esc" className="w-full">
                Back to Home
              </Button>
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
