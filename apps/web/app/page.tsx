"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@leet99/ui";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAudioContext } from "../contexts/audio-context";

export default function Home() {
  const router = useRouter();
  const { playMusic } = useAudioContext();

  // Start lobby music on mount
  useEffect(() => {
    playMusic("lobby");
  }, [playMusic]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only trigger if not in an input field
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case "c":
          router.push("/create");
          break;
        case "j":
          router.push("/join");
          break;
        case "?":
          // TODO: Open tutorial/help modal
          alert("Tutorial coming soon!");
          break;
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      {/* Title */}
      <div className="text-center">
        <div className="flex justify-center mb-4">
          <Image
            src="/icon.png"
            alt="Leet99 Logo"
            width={120}
            height={120}
            className="drop-shadow-lg"
            priority
          />
        </div>
        <h1 className="font-mono text-6xl font-bold tracking-tight text-primary glow-primary">
          LEET99
        </h1>
        <p className="mt-2 font-mono text-sm text-muted">
          Battle Royale for Coders
        </p>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3">
        <Link href="/create">
          <Button variant="primary" hotkey="C" className="min-w-64">
            Create Room
          </Button>
        </Link>
        <Link href="/join">
          <Button variant="secondary" hotkey="J" className="min-w-64">
            Join Room
          </Button>
        </Link>
      </div>

      {/* Help link */}
      {/* <Button
        variant="ghost"
        hotkey="?"
        className="text-muted"
        onClick={() => alert("Tutorial coming soon!")}
      >
        How to Play
      </Button> */}

      {/* Version */}
      <p className="fixed bottom-4 right-4 font-mono text-xs text-muted">
        v0.1.0
      </p>
    </main>
  );
}
