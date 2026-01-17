"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Panel,
  EditorWrapper,
  ProblemDisplay,
  StackPanel,
  Minimap,
  TerminalLog,
  ShopModal,
  TargetingModal,
  Timer,
  Button,
  MatchResultsModal,
  EffectsOverlay,
  ScoreDisplay,
  useGameEffects,
} from "@leet99/ui";
import { useGameState } from "../../../contexts/game-state-context";
import { useHotkeys } from "../../../components/hotkey-provider";
import { useKeyboardShortcuts } from "../../../hooks/use-keyboard-shortcuts";
import type { PlayerPublic, EventLogEntry } from "@leet99/contracts";
import { GameWrapper } from "./game-wrapper";

function GamePageContent() {
  const params = useParams();
  const roomId = params.roomId as string;
  const router = useRouter();

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
    targetingMode,
    matchPhase,
    matchEndAt,
    matchEndResult,
    runCode,
    submitCode,
    purchaseItem,
    setTargetMode,
    returnToLobby,
    updateCode,
    playerId,
    isHost,
  } = useGameState();

  // Effects system
  const { triggerEffect } = useGameEffects();

  // Hotkey state
  const { vimMode, setVimMode } = useHotkeys();

  // Local editor state
  const [code, setCode] = useState(
    currentProblem?.problemType === "code" ? currentProblem.starterCode : ""
  );
  const [codeVersion, setCodeVersion] = useState(1);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [shopOpen, setShopOpen] = useState(false);
  const [targetingOpen, setTargetingOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  // Track previous values for effect triggers
  const prevScoreRef = useRef(score);
  const prevDebuffRef = useRef(activeDebuff);

  // Update code when problem changes
  useEffect(() => {
    if (currentProblem) {
      if (currentProblem.problemType === "code") {
        setCode(currentProblem.starterCode);
      } else {
        setCode("");
      }
      setCodeVersion(1);
      setSelectedOptionId(null);
      // Clear judge result when problem changes
      // The judge result will be set when we get a new JUDGE_RESULT message
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProblem?.problemId]);

  // Trigger effects on score change
  useEffect(() => {
    if (score > prevScoreRef.current) {
      triggerEffect("success");
      if (score - prevScoreRef.current >= 10) {
        triggerEffect("confetti");
      }
    }
    prevScoreRef.current = score;
  }, [score, triggerEffect]);

  // Trigger effects on attack received
  useEffect(() => {
    if (activeDebuff && !prevDebuffRef.current) {
      triggerEffect("attack");
    }
    prevDebuffRef.current = activeDebuff;
  }, [activeDebuff, triggerEffect]);

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
  const handleRun = useCallback(async () => {
    if (activeDebuff?.type === "ddos" || isRunning) {
      return;
    }
    setIsRunning(true);
    try {
      await runCode(code);
    } finally {
      setIsRunning(false);
    }
  }, [activeDebuff, code, isRunning, runCode]);

  // Handle Submit code / option
  const handleSubmit = useCallback(async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const submission = currentProblem?.problemType === "mcq"
        ? (selectedOptionId || "")
        : code;
      await submitCode(submission);
    } finally {
      setIsSubmitting(false);
    }
  }, [code, isSubmitting, submitCode, currentProblem, selectedOptionId]);

  // Handle shop toggle
  const handleShopToggle = () => {
    setShopOpen(!shopOpen);
    if (!shopOpen) setTargetingOpen(false);
  };

  // Handle targeting toggle
  const handleTargetingToggle = () => {
    setTargetingOpen(!targetingOpen);
    if (!targetingOpen) setShopOpen(false);
  };

  // Register global shortcuts
  useKeyboardShortcuts({
    shortcuts: [
      ...(currentProblem?.problemType === "code"
        ? [{ key: "r", altKey: true, action: handleRun, description: "Run Code" }]
        : []),
      { key: "s", altKey: true, action: handleSubmit, description: "Submit Code" },
      { key: "b", altKey: true, action: handleShopToggle, description: "Toggle Shop" },
      { key: "t", altKey: true, action: handleTargetingToggle, description: "Targeting Mode" },
    ],
    enabled: true,
  });

  // Apply Flashbang debuff theme switching
  useEffect(() => {
    const theme =
      activeDebuff?.type === "flashbang" ? "leet99-flashbang" : "leet99";
    document.documentElement.setAttribute("data-theme", theme);

    // Add/remove flashbang transition class
    if (activeDebuff?.type === "flashbang") {
      document.documentElement.classList.add(
        "transition-colors",
        "duration-1000",
      );
    } else {
      document.documentElement.classList.remove(
        "transition-colors",
        "duration-1000",
      );
    }
  }, [activeDebuff]);

  // Resizable state
  const [problemWidth, setProblemWidth] = useState(320);
  const [terminalHeight, setTerminalHeight] = useState(160);

  const [isResizingWidth, setIsResizingWidth] = useState(false);
  const [isResizingHeight, setIsResizingHeight] = useState(false);

  const startRef = useRef({ x: 0, y: 0, w: 0, h: 0 });

  // Handle horizontal resize (Problem Panel)
  useEffect(() => {
    if (!isResizingWidth) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startRef.current.x;
      const newWidth = Math.min(
        Math.max(startRef.current.w + deltaX, 240),
        600,
      );
      setProblemWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizingWidth(false);
      document.body.style.cursor = "default";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "col-resize";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizingWidth]);

  // Handle vertical resize (Terminal Log)
  useEffect(() => {
    if (!isResizingHeight) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Delta is positive when dragging UP (terminal gets taller)
      const deltaY = startRef.current.y - e.clientY;
      const newHeight = Math.min(
        Math.max(startRef.current.h + deltaY, 64),
        600,
      );
      setTerminalHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizingHeight(false);
      document.body.style.cursor = "default";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "row-resize";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizingHeight]);

  const startWidthResize = (e: React.MouseEvent) => {
    startRef.current = {
      x: e.clientX,
      y: e.clientY,
      w: problemWidth,
      h: terminalHeight,
    };
    setIsResizingWidth(true);
  };

  const startHeightResize = (e: React.MouseEvent) => {
    startRef.current = {
      x: e.clientX,
      y: e.clientY,
      w: problemWidth,
      h: terminalHeight,
    };
    setIsResizingHeight(true);
  };

  // Derived state
  const vimLocked = activeDebuff?.type === "vimLock";
  const memoryLeakActive = activeDebuff?.type === "memoryLeak";
  const ddosActive = activeDebuff?.type === "ddos";

  // Map players for minimap (filter out lobby players)
  const minimapPlayers = playersPublic
    .filter((p: PlayerPublic) => p.status !== "lobby")
    .map((p: PlayerPublic) => ({
      id: p.playerId,
      username: p.username,
      status: p.status as "coding" | "error" | "underAttack" | "eliminated",
      isBot: p.role === "bot",
      score: p.score,
      activeDebuff: p.activeDebuff,
    }));

  // Terminal messages with enhanced types
  const terminalMessages = eventLog.map((entry: EventLogEntry) => ({
    type: (entry.level === "error"
      ? "danger"
      : entry.level === "warning"
        ? "warning"
        : "info") as "info" | "success" | "warning" | "danger" | "system",
    content: entry.message,
    timestamp: new Date(entry.at).toLocaleTimeString(),
  }));

  // If match ended, show leaderboard instead of game
  if (matchPhase === "ended") {
    return (
      <MatchResultsModal
        isOpen={true}
        endReason={matchEndResult?.endReason || "timeExpired"}
        standings={matchEndResult?.standings || []}
        selfPlayerId={playerId || ""}
        isHost={isHost}
        onReturnToLobby={() => {
          returnToLobby();
          router.push(`/lobby/${roomId}`);
        }}
        onExit={() => router.push("/")}
      />
    );
  }

  return (
    <main className="flex h-screen flex-col p-2 overflow-hidden relative">
      {/* Effects Overlay */}
      <EffectsOverlay
        ddosActive={ddosActive}
        memoryLeakActive={memoryLeakActive}
      />

      {/* Resizing Overlay to prevent Monaco interference */}
      {(isResizingWidth || isResizingHeight) && (
        <div className="fixed inset-0 z-[100] cursor-move" />
      )}

      {/* Top Bar */}
      <div className="flex items-center justify-between mb-2 px-2">
        <Timer
          endsAt={matchEndAt || new Date().toISOString()}
          serverTime={serverTime || new Date().toISOString()}
        />
        <div className="font-mono text-sm text-muted flex items-center gap-2">
          Room: <span className="text-primary">{roomId}</span>
          {!isConnected && (
            <span className="text-error animate-pulse">(Disconnected)</span>
          )}
          {activeDebuff && (
            <span
              className={`
              px-2 py-0.5 text-xs font-bold border
              ${activeDebuff.type === "ddos" ? "border-error text-error animate-pulse" : ""}
              ${activeDebuff.type === "flashbang" ? "border-warning text-warning" : ""}
              ${activeDebuff.type === "vimLock" ? "border-success text-success vim-cursor-blink" : ""}
              ${activeDebuff.type === "memoryLeak" ? "border-warning text-warning glitch-text" : ""}
            `}
              data-text={`[${activeDebuff.type.toUpperCase()}]`}
            >
              [{activeDebuff.type.toUpperCase()}]
            </span>
          )}
        </div>
      </div>

      {/* Main Game Layout */}
      <div className="flex flex-1 gap-1 min-h-0">
        {/* Left: Problem Panel */}
        <div className="flex-shrink-0" style={{ width: `${problemWidth}px` }}>
          {currentProblem ? (
            <ProblemDisplay
              problem={{
                title: currentProblem.title,
                difficulty: currentProblem.difficulty,
                prompt: currentProblem.prompt,
                signature:
                  currentProblem.problemType === "code"
                    ? (currentProblem as Extract<
                        typeof currentProblem,
                        { problemType: "code" }
                      >).signature
                    : "",
                publicTests:
                  currentProblem.problemType === "code"
                    ? (
                        currentProblem as Extract<
                          typeof currentProblem,
                          { problemType: "code" }
                        >
                      ).publicTests.map((t) => ({
                        input: String(t.input ?? ""),
                        output: String(t.output ?? ""),
                      }))
                    : [],
                isGarbage: currentProblem.isGarbage,
                problemType: currentProblem.problemType,
                options:
                  currentProblem.problemType === "mcq"
                    ? (
                        currentProblem as Extract<
                          typeof currentProblem,
                          { problemType: "mcq" }
                        >
                      ).options
                    : undefined,
                selectedOptionId: selectedOptionId || undefined,
                onOptionSelect: (id) => setSelectedOptionId(id),
              }}
              testResults={
                lastJudgeResult &&
                lastJudgeResult.problemId === currentProblem.problemId
                  ? lastJudgeResult.publicTests.map((t) => ({
                      index: t.index,
                      passed: t.passed,
                      expected: t.expected ? String(t.expected) : undefined,
                      received: t.received ? String(t.received) : undefined,
                    }))
                  : []
              }
            />
          ) : (
            <Panel title="PROBLEM" className="h-full">
              <div className="flex items-center justify-center h-full text-muted font-mono text-sm animate-pulse">
                Loading problem...
              </div>
            </Panel>
          )}
        </div>

        {/* Vertical Resizer */}
        <div
          className="w-1.5 hover:bg-primary/50 cursor-col-resize transition-colors active:bg-primary z-50"
          onMouseDown={startWidthResize}
        />

        {/* Center: Editor */}
        <div className="flex-1 flex flex-col gap-1 min-w-0">
          <Panel
            title={`EDITOR${vimLocked ? " [VIM LOCKED]" : vimMode ? " [VIM]" : ""}`}
            className={`flex-1 min-h-0 ${vimLocked ? "vim-cursor-blink" : ""}`}
            noPadding
          >
            {currentProblem?.problemType === "mcq" ? (
              <div className="flex items-center justify-center h-full text-muted font-mono text-sm border-2 border-dashed border-secondary m-4">
                Select an option on the left to solve this problem
              </div>
            ) : (
              <EditorWrapper
                code={code}
                onChange={handleCodeChange}
                language="python"
                vimMode={vimMode}
                vimLocked={vimLocked}
                onVimModeChange={setVimMode}
                className="h-full"
              />
            )}
          </Panel>

          {/* Horizontal Resizer */}
          <div
            className="h-1.5 hover:bg-primary/50 cursor-row-resize transition-colors active:bg-primary z-50"
            onMouseDown={startHeightResize}
          />

          {/* Terminal Log */}
          <div
            className="flex-shrink-0"
            style={{ height: `${terminalHeight}px` }}
          >
            <Panel title="TERMINAL LOG" className="h-full" noPadding>
              <TerminalLog messages={terminalMessages} />
            </Panel>
          </div>

          {/* Action Bar */}
          <div
            className={`
            flex items-center gap-3 p-2 border border-secondary bg-base-200 flex-shrink-0
            transition-all duration-300
            ${ddosActive ? "border-error animate-pulse-red" : ""}
          `}>
            {currentProblem?.problemType === "code" && (
              <Button
                variant="primary"
                hotkey="Alt+R"
                onClick={handleRun}
                disabled={ddosActive || isRunning}
                className={`
                  transition-all duration-200
                  ${ddosActive ? "opacity-50 cursor-not-allowed" : ""}
                  ${isRunning ? "animate-pulse" : ""}
                `}
              >
                {isRunning ? "Running..." : "Run"}
              </Button>
            )}
            <Button
              variant="primary"
              hotkey="Alt+S"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className={isSubmitting ? "animate-pulse" : ""}
            >
              {isSubmitting ? "Submitting..." : "Submit"}
            </Button>
            <Button
              variant="secondary"
              hotkey="Alt+B"
              onClick={handleShopToggle}
            >
              Shop
            </Button>
            <Button
              variant="secondary"
              hotkey="Alt+T"
              onClick={handleTargetingToggle}
            >
              Target
            </Button>
            <div className="flex-1"></div>

            {/* Score Display with animations */}
            <ScoreDisplay score={score} streak={solveStreak} />

            <div className="font-mono text-xs text-muted max-w-[120px] truncate text-right">
              T:{" "}
              <span className="text-primary">
                {targetingMode.toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Stack & Minimap */}
        <div className="w-64 flex-shrink-0 space-y-2 flex flex-col min-h-0">
          {/* Minimap */}
          <Panel title="MINIMAP" className="flex-shrink-0">
            <Minimap
              players={minimapPlayers}
              selfId={playerId || ""}
              targetId={undefined}
              onPlayerClick={(id) => console.log("Target player:", id)}
            />
          </Panel>

          {/* Stack */}
          <StackPanel
            stack={problemStack.map((p, index) => ({
              id: `${p.problemId}-${index}`,
              title: p.title,
              difficulty: p.difficulty,
              isGarbage: p.isGarbage,
            }))}
            stackLimit={roomSettings?.stackLimit || 10}
            memoryLeakActive={memoryLeakActive}
            className="flex-1 min-h-0"
          />
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

      {/* Targeting Modal */}
      <TargetingModal
        isOpen={targetingOpen}
        activeMode={targetingMode}
        onSelect={(modeId) => {
          setTargetMode(modeId as any);
        }}
        onClose={() => setTargetingOpen(false)}
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
