"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Dropdown } from "@leet99/ui";
import Link from "next/link";

export default function CreateRoomPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [duration, setDuration] = useState("10");
  const [difficulty, setDifficulty] = useState("moderate");
  const [attackIntensity, setAttackIntensity] = useState("low");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const usernameRef = useRef<HTMLInputElement>(null);

  // Auto-focus username input
  useEffect(() => {
    usernameRef.current?.focus();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) {
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
  }, [router, username]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validation
    const trimmedUsername = username.trim();
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
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: trimmedUsername,
          settings: {
            matchDuration: parseInt(duration),
            difficultyProfile: difficulty,
            attackIntensity: attackIntensity,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error?.message || "Failed to create room");
        setLoading(false);
        return;
      }

      // Store credentials in localStorage for reconnection
      localStorage.setItem(
        `room_${data.roomId}`,
        JSON.stringify({
          roomId: data.roomId,
          playerId: data.playerId,
          playerToken: data.playerToken,
          wsUrl: data.wsUrl,
        })
      );

      // Navigate to lobby
      router.push(`/lobby/${data.roomId}`);
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
            CREATE ROOM
          </h1>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            ref={usernameRef}
            label="Your Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter username"
            maxLength={16}
            disabled={loading}
          />

          {/* Settings Section */}
          <div className="border border-secondary p-4 space-y-3">
            <div className="font-mono text-sm text-muted mb-3">
              Room Settings (optional)
            </div>

            <Dropdown
              label="Duration"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              disabled={loading}
              options={[
                { value: "6", label: "6 minutes" },
                { value: "8", label: "8 minutes" },
                { value: "10", label: "10 minutes" },
              ]}
            />

            <Dropdown
              label="Difficulty"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              disabled={loading}
              options={[
                { value: "beginner", label: "Beginner" },
                { value: "moderate", label: "Moderate" },
                { value: "competitive", label: "Competitive" },
              ]}
            />

            <Dropdown
              label="Attack Intensity"
              value={attackIntensity}
              onChange={(e) => setAttackIntensity(e.target.value)}
              disabled={loading}
              options={[
                { value: "low", label: "Low" },
                { value: "high", label: "High" },
              ]}
            />
          </div>

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
              {loading ? "Creating..." : "Create Room"}
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
