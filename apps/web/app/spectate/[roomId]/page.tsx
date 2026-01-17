"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Panel, Button } from "@leet99/ui";

export default function SpectatePage() {
  const params = useParams();
  const _roomId = params.roomId as string;
  const [spectating, setSpectating] = useState("alice");

  return (
    <main className="flex min-h-screen flex-col p-2">
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-2 px-2">
        <div className="font-mono text-lg text-primary">
          ⏱ 09:32
          <span className="ml-4 text-base text-accent">
            SPECTATING: {spectating}
          </span>
        </div>
        <Button
          variant="ghost"
          hotkey="Tab"
          onClick={() =>
            setSpectating(spectating === "alice" ? "bob" : "alice")
          }
        >
          Switch Player
        </Button>
      </div>

      {/* Main Game Layout (Same as Game Page but Read-Only) */}
      <div className="flex flex-1 gap-2">
        {/* Left: Problem Panel */}
        <div className="w-80">
          <Panel title="PROBLEM" className="h-full">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <h3 className="font-mono text-lg">Two Sum</h3>
                <span className="px-2 py-1 bg-success/20 text-success text-xs font-mono">
                  EASY
                </span>
              </div>
              <p className="text-sm text-base-content">
                Given an array of integers nums and an integer target, return
                indices of the two numbers such that they add up to target.
              </p>
              <div className="border border-secondary p-2 bg-base-300">
                <code className="font-mono text-xs text-base-content">
                  def two_sum(nums: list[int], target: int) -&gt; list[int]:
                </code>
              </div>
            </div>
          </Panel>
        </div>

        {/* Center: Editor (Read-Only) */}
        <div className="flex-1 flex flex-col gap-2">
          <Panel title="EDITOR (READ-ONLY)" className="flex-1">
            <div className="h-full bg-base-300 p-4 font-mono text-sm opacity-75">
              <code className="text-base-content">
                def two_sum(nums, target):
                <br />
                &nbsp;&nbsp;&nbsp;&nbsp;hash_map = &#123;&#125;
                <br />
                &nbsp;&nbsp;&nbsp;&nbsp;for i, num in enumerate(nums):
                <br />
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;complement =
                target - num
                <br />
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;if complement in
                hash_map:
                <br />
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;return
                [hash_map[complement], i]
                <br />
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;hash_map[num] =
                i
              </code>
            </div>
          </Panel>

          {/* Terminal Log */}
          <Panel title="TERMINAL LOG" className="h-32">
            <div className="space-y-1 font-mono text-xs">
              <div className="text-success">&gt; Match started</div>
              <div className="text-base-content">
                &gt; {spectating} is solving Two Sum...
              </div>
              <div className="text-success">
                &gt; {spectating} passed all public tests
              </div>
            </div>
          </Panel>

          {/* Spectator Controls */}
          <div className="flex items-center gap-3 p-2 border border-secondary bg-base-200">
            <div className="font-mono text-sm text-muted">Spectator Mode</div>
            <div className="flex-1"></div>
            <div className="font-mono text-sm">
              Watching: <span className="text-accent">{spectating}</span>
            </div>
            <div className="font-mono text-sm">
              Score: <span className="text-accent">45</span>
            </div>
          </div>
        </div>

        {/* Right: Stack & Minimap */}
        <div className="w-64 space-y-2">
          {/* Minimap */}
          <Panel title="MINIMAP">
            <div className="grid grid-cols-4 gap-1">
              {[
                { name: "al", active: spectating === "alice" },
                { name: "bo", active: spectating === "bob" },
                { name: "ch", active: false },
                { name: "da", active: false },
              ].map((player, i) => (
                <button
                  key={i}
                  onClick={() =>
                    player.name === "al"
                      ? setSpectating("alice")
                      : player.name === "bo"
                        ? setSpectating("bob")
                        : null
                  }
                  className={`
                    aspect-square flex items-center justify-center
                    border text-xs font-mono
                    ${player.active ? "border-primary glow-primary" : "border-secondary"}
                    hover:border-primary/50
                  `}
                >
                  {player.active && "▶"}
                  {player.name}
                </button>
              ))}
            </div>
          </Panel>

          {/* Stack ({spectating}'s stack) */}
          <Panel title={`STACK (${spectating})`} className="flex-1">
            <div className="space-y-2">
              {[
                { title: "Reverse Str", difficulty: "hard" },
                { title: "Valid Paren", difficulty: "medium" },
              ].map((problem, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 p-2 border border-secondary"
                >
                  <div
                    className={`
                      w-1 h-8
                      ${problem.difficulty === "easy" ? "bg-success" : problem.difficulty === "medium" ? "bg-warning" : "bg-error"}
                    `}
                  />
                  <span className="font-mono text-xs">{problem.title}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </main>
  );
}
