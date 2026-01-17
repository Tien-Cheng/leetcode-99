"use client";

import { useParams } from "next/navigation";
import { Panel } from "@leet99/ui";

export default function GamePage() {
  const params = useParams();
  const roomId = params.roomId as string;

  return (
    <main className="flex min-h-screen flex-col p-2">
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-2 px-2">
        <div className="font-mono text-lg text-primary">⏱ 09:32</div>
        <div className="font-mono text-sm text-muted">Room: {roomId}</div>
      </div>

      {/* Main Game Layout */}
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
              <div>
                <div className="font-mono text-xs text-muted mb-1">
                  Public Tests:
                </div>
                <div className="space-y-1 text-xs font-mono">
                  <div className="text-success">✓ Test 1: [2,7,11], 9 → [0,1]</div>
                  <div className="text-error">✗ Test 2: [3,2,4], 6 → [1,2]</div>
                  <div className="text-muted">○ Test 3: [3,3], 6 → [0,1]</div>
                </div>
              </div>
            </div>
          </Panel>
        </div>

        {/* Center: Editor */}
        <div className="flex-1 flex flex-col gap-2">
          <Panel title="EDITOR" className="flex-1">
            <div className="h-full bg-base-300 p-4 font-mono text-sm">
              <code className="text-base-content">
                def two_sum(nums, target):
                <br />
                &nbsp;&nbsp;&nbsp;&nbsp;# your code here
                <br />
                &nbsp;&nbsp;&nbsp;&nbsp;pass
              </code>
            </div>
          </Panel>

          {/* Terminal Log */}
          <Panel title="TERMINAL LOG" className="h-32">
            <div className="space-y-1 font-mono text-xs">
              <div className="text-success">&gt; Match started</div>
              <div className="text-base-content">&gt; alice solved Easy (+5) and sent Garbage Drop to bob</div>
              <div className="text-warning">&gt; You received Flashbang from charlie!</div>
              <div className="text-error">&gt; dave was eliminated (stack overflow)</div>
            </div>
          </Panel>

          {/* Action Bar */}
          <div className="flex items-center gap-3 p-2 border border-secondary bg-base-200">
            <button className="px-4 py-2 border border-primary text-primary hover-glow-primary font-mono text-sm">
              [Alt+R] Run
            </button>
            <button className="px-4 py-2 border border-primary text-primary hover-glow-primary font-mono text-sm">
              [Alt+S] Submit
            </button>
            <button className="px-4 py-2 border border-secondary text-base-content font-mono text-sm">
              [Alt+B] Shop
            </button>
            <div className="flex-1"></div>
            <div className="font-mono text-sm">Score: <span className="text-accent">45</span></div>
            <div className="font-mono text-sm">Streak: <span className="text-warning">2</span></div>
          </div>
        </div>

        {/* Right: Stack & Minimap */}
        <div className="w-64 space-y-2">
          {/* Minimap */}
          <Panel title="MINIMAP">
            <div className="grid grid-cols-4 gap-1">
              {["al", "bo", "ch", "da", "⊕", "░░", "", ""].map((name, i) => (
                <div
                  key={i}
                  className={`
                    aspect-square flex items-center justify-center
                    border text-xs font-mono
                    ${name === "⊕" ? "border-primary glow-primary" : name === "░░" ? "border-warning" : name ? "border-secondary" : "border-transparent"}
                    ${name === "░░" ? "bg-warning/10" : ""}
                  `}
                >
                  {name}
                </div>
              ))}
            </div>
          </Panel>

          {/* Stack */}
          <Panel title="STACK (4/10)" className="flex-1">
            <div className="space-y-2">
              {[
                { title: "Reverse Str", difficulty: "hard" },
                { title: "Valid Paren", difficulty: "medium" },
                { title: "Garbage #1", difficulty: "easy", isGarbage: true },
                { title: "Two Pointers", difficulty: "medium" },
              ].map((problem, i) => (
                <div
                  key={i}
                  className={`
                    flex items-center gap-2 p-2 border border-secondary
                    ${problem.isGarbage ? "striped-pattern" : ""}
                  `}
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
              <div className="border-t-2 border-dashed border-error mt-2 pt-2">
                <div className="text-center font-mono text-xs text-error">
                  OVERFLOW
                </div>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </main>
  );
}
