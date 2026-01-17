"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import {
  Panel,
  EditorWrapper,
  ProblemDisplay,
  StackPanel,
  Minimap,
  TerminalLog,
  ShopModal,
  Timer,
  Button,
} from "@leet99/ui";
import { useGameState } from "../../../contexts/game-state-context";
import { useHotkeys } from "../../../components/hotkey-provider";
import { useKeyboardShortcuts } from "../../../hooks/use-keyboard-shortcuts";
import { GameWrapper } from "./game-wrapper";

function GamePageContent() {
  const params = useParams();
  const roomId = params.roomId as string;

  // Game state from context
  const {
    isConnected,
    playersPublic,
    roomSettings,
    currentProblem,
    problemStack,
    activeDebuff,
    score,
    solveStreak,
    eventLog,
    lastJudgeResult,
    serverTime,
    runCode,
    submitCode,
    purchaseItem,
    updateCode,
  } = useGameState();

  // Hotkey state
  const { vimMode, setVimMode } = useHotkeys();

  // Local editor state
  const [code, setCode] = useState(currentProblem?.starterCode || "");
  const [codeVersion, setCodeVersion] = useState(1);
  const [shopOpen, setShopOpen] = useState(false);

  // Update code when problem changes
  useEffect(() => {
    if (currentProblem) {
      setCode(currentProblem.starterCode);
      setCodeVersion(1);
    }
  }, [currentProblem?.problemId]);

  // Debounced code update for spectators
  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentProblem) {
        updateCode(code, codeVersion);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [code, codeVersion, currentProblem, updateCode]);

  // Handle code change
  const handleCodeChange = (newCode: string) => {
    setCode(newCode);
    setCodeVersion((v) => v + 1);
  };

  // Handle Run code
  const handleRun = async () => {
    if (activeDebuff?.type === "ddos") {
      // Cannot run while DDOS active
      return;
    }
    await runCode(code);
  };

  // Handle Submit code
  const handleSubmit = async () => {
    await submitCode(code);
  };

  // Handle shop toggle
  const handleShopToggle = () => {
    setShopOpen(!shopOpen);
  };

  // Register global shortcuts
  useKeyboardShortcuts({
    shortcuts: [
      { key: "r", altKey: true, action: handleRun, description: "Run Code" },
      { key: "s", altKey: true, action: handleSubmit, description: "Submit Code" },
      { key: "b", altKey: true, action: handleShopToggle, description: "Toggle Shop" },
      { key: "1", action: () => shopOpen && purchaseItem("clearDebuff"), description: "Purchase Clear Debuff" },
      { key: "2", action: () => shopOpen && purchaseItem("memoryDefrag"), description: "Purchase Memory Defrag" },
      { key: "3", action: () => shopOpen && purchaseItem("skipProblem"), description: "Purchase Skip Problem" },
      { key: "4", action: () => shopOpen && purchaseItem("rateLimiter"), description: "Purchase Rate Limiter" },
      { key: "5", action: () => shopOpen && purchaseItem("hint"), description: "Purchase Hint" },
    ],
    enabled: true,
  });

  // Apply Flashbang debuff theme switching
  useEffect(() => {
    const theme =
      activeDebuff?.type === "flashbang" ? "leet99-flashbang" : "leet99";
    document.documentElement.setAttribute("data-theme", theme);
  }, [activeDebuff]);

  // Check if Vim is locked
  const vimLocked = activeDebuff?.type === "vimLock";
  const memoryLeakActive = activeDebuff?.type === "memoryLeak";
  const ddosActive = activeDebuff?.type === "ddos";

  // Map players for minimap (filter out lobby players)
  const minimapPlayers = playersPublic
    .filter((p) => p.status !== "lobby")
    .map((p) => ({
      id: p.playerId,
      username: p.username,
      status: p.status as "coding" | "error" | "underAttack" | "eliminated",
      isBot: p.role === "bot",
    }));

  // Terminal messages
  const terminalMessages = eventLog.map((entry) => ({
    type: (entry.level === "error"
      ? "danger"
      : entry.level === "warning"
        ? "warning"
        : "info") as "info" | "success" | "warning" | "danger" | "system",
    content: entry.message,
    timestamp: new Date(entry.at).toLocaleTimeString(),
  }));

  return (
    <main className="flex min-h-screen flex-col p-2">
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-2 px-2">
        <Timer
          endsAt={roomSettings?.matchDurationSec ? new Date(Date.now() + roomSettings.matchDurationSec * 1000).toISOString() : new Date().toISOString()}
          serverTime={serverTime || new Date().toISOString()}
        />
        <div className="font-mono text-sm text-muted">
          Room: {roomId} {!isConnected && <span className="text-error">(Disconnected)</span>}
        </div>
      </div>

      {/* Main Game Layout */}
      <div className="flex flex-1 gap-2 min-h-0">
        {/* Left: Problem Panel */}
        <div className="w-80 flex-shrink-0">
          {currentProblem ? (
            <ProblemDisplay
              problem={{
                title: currentProblem.title,
                difficulty: currentProblem.difficulty,
                prompt: currentProblem.prompt,
                signature: currentProblem.signature,
                publicTests: currentProblem.publicTests.map((t) => ({
                  input: String(t.input),
                  output: String(t.output),
                })),
                isGarbage: currentProblem.isGarbage,
              }}
              testResults={lastJudgeResult?.publicTests.map((t) => ({
                index: t.index,
                passed: t.passed,
                expected: t.expected ? String(t.expected) : undefined,
                received: t.received ? String(t.received) : undefined,
              }))}
            />
          ) : (
            <Panel title="PROBLEM" className="h-full">
              <div className="flex items-center justify-center h-full text-muted font-mono text-sm">
                No active problem
              </div>
            </Panel>
          )}
        </div>

        {/* Center: Editor */}
        <div className="flex-1 flex flex-col gap-2 min-w-0">
          <Panel title={`EDITOR${vimLocked ? " [VIM LOCKED]" : vimMode ? " [VIM]" : ""}`} className="flex-1 min-h-0" noPadding>
            <EditorWrapper
              code={code}
              onChange={handleCodeChange}
              language="python"
              vimMode={vimMode}
              vimLocked={vimLocked}
              onVimModeChange={setVimMode}
              className="h-full"
            />
          </Panel>

          {/* Terminal Log */}
          <Panel title="TERMINAL LOG" className="h-32 flex-shrink-0" noPadding>
            <TerminalLog messages={terminalMessages} />
          </Panel>

          {/* Action Bar */}
          <div className="flex items-center gap-3 p-2 border border-secondary bg-base-200 flex-shrink-0">
            <Button
              variant="primary"
              hotkey="Alt+R"
              onClick={handleRun}
              disabled={ddosActive}
              className={ddosActive ? "animate-pulse border-error text-error" : ""}
            >
              Run
            </Button>
            <Button variant="primary" hotkey="Alt+S" onClick={handleSubmit}>
              Submit
            </Button>
            <Button variant="secondary" hotkey="Alt+B" onClick={handleShopToggle}>
              Shop
            </Button>
            <div className="flex-1"></div>
            <div className="font-mono text-sm">
              Score: <span className="text-accent">{score}</span>
            </div>
            <div className="font-mono text-sm">
              Streak: <span className="text-warning">{solveStreak}</span>
            </div>
            {activeDebuff && (
              <div className="font-mono text-xs text-error">
                [{activeDebuff.type.toUpperCase()}]
              </div>
            )}
          </div>
        </div>

        {/* Right: Stack & Minimap */}
        <div className="w-64 flex-shrink-0 space-y-2 flex flex-col min-h-0">
          {/* Minimap */}
          <Panel title="MINIMAP" className="flex-shrink-0">
            <Minimap
              players={minimapPlayers}
              selfId={playersPublic.find((p) => p.username === "You")?.playerId || ""}
              targetId={undefined}
              onPlayerClick={(id) => console.log("Target player:", id)}
            />
          </Panel>

          {/* Stack */}
          <Panel
            title={`STACK (${problemStack.length}/${roomSettings?.stackLimit || 10})`}
            className="flex-1 min-h-0 overflow-hidden"
          >
            <StackPanel
              stack={problemStack.map((p) => ({
                id: p.problemId,
                title: p.title,
                difficulty: p.difficulty,
                isGarbage: p.isGarbage,
              }))}
              stackLimit={roomSettings?.stackLimit || 10}
              memoryLeakActive={memoryLeakActive}
            />
          </Panel>
        </div>
      </div>

      {/* Shop Modal */}
      <ShopModal
        isOpen={shopOpen}
        score={score}
        items={[
          { id: "clearDebuff", name: "Clear Debuff", cost: 10, hotkey: "1" },
          { id: "memoryDefrag", name: "Memory Defrag", cost: 10, hotkey: "2" },
          { id: "skipProblem", name: "Skip Problem", cost: 15, hotkey: "3" },
          { id: "rateLimiter", name: "Rate Limiter", cost: 10, hotkey: "4" },
          { id: "hint", name: "Hint", cost: 5, hotkey: "5" },
        ]}
        onPurchase={(itemId) => {
          purchaseItem(itemId as any);
          setShopOpen(false);
        }}
        onClose={() => setShopOpen(false)}
      />
    </main>
  );
}

export default function GamePage() {
  const params = useParams();
  const roomId = params.roomId as string;

  return (
    <GameWrapper roomId={roomId}>
      <GamePageContent />
    </GameWrapper>
  );
}
