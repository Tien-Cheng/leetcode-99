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
  Toast,
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
    activeBuff,
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
    lastAttackerInfo,
    __debugSetDebuff,
    shopCatalog,
    shopCooldowns,

    debugAddScore,
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
  const [shopError, setShopError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [targetingOpen, setTargetingOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  // Sync currentTime with serverTime when serverTime updates
  useEffect(() => {
    if (serverTime) {
      setCurrentTime(new Date(serverTime).getTime());
    }
  }, [serverTime]);

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

  // Show error toast for wrong MCQ answer
  useEffect(() => {
    if (
      lastJudgeResult &&
      currentProblem?.problemType === "mcq" &&
      lastJudgeResult.problemId === currentProblem.problemId &&
      !lastJudgeResult.passed
    ) {
      setToast({
        message: "Incorrect answer. Try again!",
        type: "error",
      });
    }
  }, [lastJudgeResult, currentProblem]);

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

  // Secret debug handlers to trigger debuffs (for testing)
  // Using actual game durations
  const triggerDebuffDDOS = useCallback(() => {
    const endsAt = new Date(Date.now() + 8000).toISOString();
    __debugSetDebuff({ type: "ddos", endsAt });
    triggerEffect("attack");
    console.log("[DEBUG] Triggered DDOS debuff (8s)");
  }, [__debugSetDebuff, triggerEffect]);

  const triggerDebuffFlashbang = useCallback(() => {
    const endsAt = new Date(Date.now() + 24000).toISOString();
    __debugSetDebuff({ type: "flashbang", endsAt });
    triggerEffect("attack");
    console.log("[DEBUG] Triggered Flashbang debuff (24s)");
    console.log("[DEBUG] Setting activeDebuff to:", { type: "flashbang", endsAt });
  }, [__debugSetDebuff, triggerEffect]);

  const triggerDebuffVimLock = useCallback(() => {
    const endsAt = new Date(Date.now() + 12000).toISOString();
    __debugSetDebuff({ type: "vimLock", endsAt });
    triggerEffect("attack");
    console.log("[DEBUG] Triggered Vim Lock debuff (12s)");
  }, [__debugSetDebuff, triggerEffect]);

  const triggerDebuffMemoryLeak = useCallback(() => {
    const endsAt = new Date(Date.now() + 30000).toISOString();
    __debugSetDebuff({ type: "memoryLeak", endsAt });
    triggerEffect("attack");
    console.log("[DEBUG] Triggered Memory Leak debuff (30s)");
  }, [__debugSetDebuff, triggerEffect]);

  const clearDebuffManual = useCallback(() => {
    __debugSetDebuff(null);
    console.log("[DEBUG] Cleared all debuffs");
  }, [__debugSetDebuff]);

  // Log debug shortcuts on mount
  useEffect(() => {
    console.log(
      "%c🎮 DEBUG SHORTCUTS ENABLED",
      "color: #00ffd5; font-weight: bold; font-size: 14px;",
    );
    console.log(
      "%cCtrl+Shift+1: Trigger DDOS (blocks Run button for 8s)",
      "color: #ff6b6b;",
    );
    console.log(
      "%cCtrl+Shift+2: Trigger Flashbang (inverts theme for 24s)",
      "color: #ffd93d;",
    );
    console.log(
      "%cCtrl+Shift+3: Trigger Vim Lock (forces Vim mode for 12s)",
      "color: #00ffd5;",
    );
    console.log(
      "%cCtrl+Shift+4: Trigger Memory Leak (glitch effects for 30s)",
      "color: #ffd93d;",
    );
    console.log(
      "%cCtrl+Shift+0: Clear all debuffs",
      "color: #6bcf7f;",
    );
  }, []);

  // Handle debug add score (testing only)
  const handleDebugAddScore = () => {
    debugAddScore(500);
  };

  // Register global shortcuts
  useKeyboardShortcuts({
    shortcuts: [
      ...(currentProblem?.problemType === "code"
        ? [{ key: "r", altKey: true, action: handleRun, description: "Run Code" }]
        : []),
      {
        key: "s",
        altKey: true,
        action: handleSubmit,
        description: "Submit Code",
      },
      {
        key: "b",
        altKey: true,
        action: handleShopToggle,
        description: "Toggle Shop",
      },
      {
        key: "t",
        altKey: true,
        action: handleTargetingToggle,
        description: "Targeting Mode",
      },
      // SECRET DEBUG SHORTCUTS (Ctrl+Shift+[key])
      {
        key: "1",
        shiftKey: true,
        ctrlKey: true,
        action: triggerDebuffDDOS,
        description: "[DEBUG] Trigger DDOS",
      },
      {
        key: "2",
        shiftKey: true,
        ctrlKey: true,
        action: triggerDebuffFlashbang,
        description: "[DEBUG] Trigger Flashbang",
      },
      {
        key: "3",
        shiftKey: true,
        ctrlKey: true,
        action: triggerDebuffVimLock,
        description: "[DEBUG] Trigger Vim Lock",
      },
      {
        key: "4",
        shiftKey: true,
        ctrlKey: true,
        action: triggerDebuffMemoryLeak,
        description: "[DEBUG] Trigger Memory Leak",
      },
      {
        key: "0",
        shiftKey: true,
        ctrlKey: true,
        action: clearDebuffManual,
        description: "[DEBUG] Clear All Debuffs",
      },
      {
        key: "$",
        shiftKey: true,
        action: handleDebugAddScore,
        description: "[DEBUG] Add 500 Points",
      },
    ],
    enabled: true,
    disableWhenInputFocused: false, // Allow debug shortcuts even when editor is focused
  });

  // Update current time every second for debuff duration display and check expiry
  useEffect(() => {
    if (activeDebuff) {
      // Update immediately
      setCurrentTime(Date.now());

      const interval = setInterval(() => {
        const now = Date.now();
        setCurrentTime(now);

        // Check if debuff has expired and clear it (client-side fallback)
        try {
          const endsAt = new Date(activeDebuff.endsAt).getTime();
          if (isNaN(endsAt)) {
            console.warn("[Debuff] Invalid endsAt timestamp:", activeDebuff.endsAt);
            return;
          }
          if (now >= endsAt) {
            console.log("[Debuff] Expired, clearing client-side");
            __debugSetDebuff(null);
          }
        } catch (e) {
          console.error("[Debuff] Error checking expiry:", e);
        }
      }, 1000);
      return () => clearInterval(interval);
    } else {
      // Reset currentTime when debuff is cleared
      setCurrentTime(Date.now());
    }
  }, [activeDebuff, __debugSetDebuff]);

  // Apply Flashbang debuff theme switching
  useEffect(() => {
    const isFlashbang = activeDebuff?.type === "flashbang";
    const theme = isFlashbang ? "leet99-flashbang" : "leet99";
    const html = document.documentElement;

    console.log("[Theme] Applying theme:", theme, "for debuff:", activeDebuff?.type);
    console.log("[Theme] Current html data-theme:", html.getAttribute("data-theme"));

    // Remove old theme class if any
    html.classList.remove("leet99", "leet99-flashbang");

    // Set the data-theme attribute (daisyUI uses this)
    html.setAttribute("data-theme", theme);

    // Force a reflow to ensure theme is applied
    void html.offsetHeight;

    // Verify it was set
    const actualTheme = html.getAttribute("data-theme");
    console.log("[Theme] Theme after setting:", actualTheme);

    if (actualTheme !== theme) {
      console.error("[Theme] Theme mismatch! Expected:", theme, "Got:", actualTheme);
    }

    // Add smooth transition when flashbang is active
    if (isFlashbang) {
      html.style.transition = "background-color 1s ease, color 1s ease, border-color 1s ease";
      // Small delay to ensure theme is applied before transition
      setTimeout(() => {
        html.style.transition = "background-color 1s ease, color 1s ease, border-color 1s ease";
      }, 10);
    } else {
      html.style.transition = "";
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
  const flashbangActive = activeDebuff?.type === "flashbang";

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

  // Map shop catalog to modal items
  const mapShopItems = () => {
    if (!shopCatalog.length) {
      return []; // Fallback during loading
    }

    const now = serverTime ? new Date(serverTime).getTime() : Date.now();
    const hotkeys = ["1", "2", "3", "4"];
    const descriptions: Record<string, string> = {
      clearDebuff: "Remove current debuff immediately",
      memoryDefrag: "Remove all garbage problems from stack",
      skipProblem: "Discard current problem and draw next (resets streak)",
      rateLimiter: "Double incoming problem interval for 30s",
      // hint: "Reveal next hint for current problem", // Disabled for now
    };
    const labels: Record<string, string> = {
      clearDebuff: "Clear Debuff",
      memoryDefrag: "Memory Defrag",
      skipProblem: "Skip Problem",
      rateLimiter: "Rate Limiter",
      // hint: "Hint", // Disabled for now
    };

    return shopCatalog.map((catalogItem, index) => {
      const cooldownEndsAt = shopCooldowns?.[catalogItem.item];
      const cooldownRemaining = cooldownEndsAt
        ? Math.max(0, Math.ceil((cooldownEndsAt - now) / 1000))
        : undefined;

      // Check if item should be disabled (grayed out but visible)
      let isDisabled = false;
      if (catalogItem.item === "clearDebuff" && !activeDebuff) {
        isDisabled = true;
      }
      if (
        catalogItem.item === "memoryDefrag" &&
        !problemStack.some((p) => p.isGarbage)
      ) {
        isDisabled = true;
      }
      // Hint disabled for now
      // if (
      //   catalogItem.item === "hint" &&
      //   (!currentProblem?.hintCount ||
      //     (playerPrivateState?.revealedHints?.length ?? 0) >=
      //       (currentProblem?.hintCount ?? 0))
      // ) {
      //   isDisabled = true;
      // }

      return {
        id: catalogItem.item,
        name: labels[catalogItem.item] || catalogItem.item,
        cost: catalogItem.cost,
        description: descriptions[catalogItem.item],
        cooldownRemaining,
        isDisabled,
        hotkey: hotkeys[index] || String(index + 1),
      };
    });
  };

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

      {/* Attacker Notification - Top Center */}
      {lastAttackerInfo && (
        <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[200] animate-slide-in-top">
          <div className="px-4 py-2 bg-error/90 text-error-content font-mono text-sm font-bold border border-error rounded shadow-lg">
            ⚠️ ATTACKED BY: {lastAttackerInfo.username.toUpperCase()} ({lastAttackerInfo.attackType.toUpperCase()})
          </div>
        </div>
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
          {activeDebuff && (() => {
            // Calculate remaining time - use currentTime which updates every second
            const now = currentTime;
            const endsAt = new Date(activeDebuff.endsAt).getTime();
            const remainingMs = Math.max(0, endsAt - now);

            // If expired, don't show the debuff (should be cleared by useEffect)
            if (remainingMs === 0) {
              return null;
            }

            const remainingSec = Math.ceil(remainingMs / 1000);
            const minutes = Math.floor(remainingSec / 60);
            const seconds = remainingSec % 60;
            const timeDisplay = minutes > 0
              ? `${minutes}:${seconds.toString().padStart(2, '0')}`
              : `${seconds}s`;

            return (
              <span
                className={`
                px-2 py-0.5 text-xs font-bold border flex items-center gap-1
                ${activeDebuff.type === "ddos" ? "border-error text-error animate-pulse" : ""}
                ${activeDebuff.type === "flashbang" ? "border-warning text-warning" : ""}
                ${activeDebuff.type === "vimLock" ? "border-success text-success vim-cursor-blink" : ""}
                ${activeDebuff.type === "memoryLeak" ? "border-warning text-warning glitch-text" : ""}
              `}
                data-text={`[${activeDebuff.type.toUpperCase()}]`}
              >
                <span>[{activeDebuff.type.toUpperCase()}]</span>
                <span className="opacity-75">({timeDisplay})</span>
              </span>
            );
          })()}
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
                      input: typeof t.input === "string" ? t.input : JSON.stringify(t.input ?? ""),
                      output: typeof t.output === "string" ? t.output : JSON.stringify(t.output ?? ""),
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
              hiddenTestsPassed={
                lastJudgeResult &&
                  lastJudgeResult.problemId === currentProblem.problemId &&
                  lastJudgeResult.kind === "submit"
                  ? lastJudgeResult.hiddenTestsPassed
                  : undefined
              }
              hiddenFailureMessage={
                lastJudgeResult &&
                  lastJudgeResult.problemId === currentProblem.problemId &&
                  lastJudgeResult.kind === "submit"
                  ? lastJudgeResult.hiddenFailureMessage
                  : undefined
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
                flashbangActive={flashbangActive}
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

            {/* Buff Indicator */}
            {activeBuff && (
              <div className="text-xs font-mono">
                <span className="text-warning">
                  [RATE LIMITER]{" "}
                  {Math.max(
                    0,
                    Math.ceil(
                      (new Date(activeBuff.endsAt).getTime() - Date.now()) /
                      1000,
                    ),
                  )}
                  s
                </span>
              </div>
            )}

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
        items={mapShopItems()}
        error={shopError}
        onPurchase={(itemId) => {
          setShopError(null);

          const item = mapShopItems().find((i) => i.id === itemId);
          if (!item) {
            setShopError("Item not found");
            return;
          }

          // Client-side validation
          if (score < item.cost) {
            setShopError(`Insufficient score (need ${item.cost} pts)`);
            return;
          }

          if (item.cooldownRemaining && item.cooldownRemaining > 0) {
            setShopError(
              `Item on cooldown (${item.cooldownRemaining}s remaining)`,
            );
            return;
          }

          if (item.isDisabled) {
            const reasons: Record<string, string> = {
              clearDebuff: "No active debuff to clear",
              memoryDefrag: "No garbage in stack",
              hint: "No more hints available",
            };
            setShopError(reasons[itemId] || "Item not available");
            return;
          }

          // Send purchase
          purchaseItem(itemId as any);

          // Show success toast
          setToast({
            message: `Purchased ${item.name} (-${item.cost} pts)`,
            type: "success",
          });

          // Keep shop open for multiple purchases
        }}
        onClose={() => {
          setShopError(null);
          setShopOpen(false);
        }}
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

      {/* Toast Notifications */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
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
