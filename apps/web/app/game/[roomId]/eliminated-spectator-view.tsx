"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  EffectsOverlay,
  EditorWrapper,
  MatchResultsModal,
  Minimap,
  Panel,
  ProblemDisplay,
  StackPanel,
  TerminalLog,
  Timer,
} from "@leet99/ui";
import type { EventLogEntry, PlayerPublic } from "@leet99/contracts";
import { useGameState } from "../../../contexts/game-state-context";

interface EliminatedSpectatorViewProps {
  roomId: string;
}

export function EliminatedSpectatorView({
  roomId,
}: EliminatedSpectatorViewProps) {
  const router = useRouter();
  const {
    isConnected,
    playersPublic,
    spectateState,
    spectatePlayer,
    eventLog,
    matchPhase,
    matchEndAt,
    matchEndResult,
    serverTime,
    isHost,
    roomSettings,
    playerId,
    score,
  } = useGameState();

  // Filter to only alive players (spectators can only watch alive players)
  const aliveTargets = useMemo(
    () =>
      playersPublic.filter(
        (player: PlayerPublic) =>
          player.role !== "spectator" &&
          player.status !== "eliminated" &&
          player.status !== "lobby",
      ),
    [playersPublic],
  );

  // All non-spectator players for minimap display (including eliminated)
  const minimapTargets = useMemo(
    () =>
      playersPublic.filter(
        (player: PlayerPublic) =>
          player.role !== "spectator" && player.status !== "lobby",
      ),
    [playersPublic],
  );

  const activeTargetId = spectateState?.playerId ?? null;

  // Auto-spectate first alive player if not already spectating
  useEffect(() => {
    if (!activeTargetId && aliveTargets.length > 0 && aliveTargets[0]) {
      spectatePlayer(aliveTargets[0].playerId);
    }
  }, [activeTargetId, aliveTargets, spectatePlayer]);

  // If current target is eliminated, switch to another alive player
  useEffect(() => {
    if (activeTargetId) {
      const targetPlayer = playersPublic.find(
        (p) => p.playerId === activeTargetId,
      );
      if (targetPlayer?.status === "eliminated" && aliveTargets.length > 0) {
        const newTarget = aliveTargets[0];
        if (newTarget) {
          spectatePlayer(newTarget.playerId);
        }
      }
    }
  }, [activeTargetId, playersPublic, aliveTargets, spectatePlayer]);

  // Apply flashbang theme if spectated player has it
  useEffect(() => {
    const theme =
      spectateState?.activeDebuff?.type === "flashbang"
        ? "leet99-flashbang"
        : "leet99";
    document.documentElement.setAttribute("data-theme", theme);

    return () => {
      document.documentElement.setAttribute("data-theme", "leet99");
    };
  }, [spectateState?.activeDebuff?.type]);

  const currentProblem = spectateState?.currentProblem ?? null;
  const queued = spectateState?.queued ?? [];
  const activeDebuff = spectateState?.activeDebuff ?? null;

  const ddosActive = activeDebuff?.type === "ddos";
  const memoryLeakActive = activeDebuff?.type === "memoryLeak";

  const minimapPlayers = minimapTargets.map((player: PlayerPublic) => ({
    id: player.playerId,
    username: player.username,
    status: player.status as "coding" | "error" | "underAttack" | "eliminated",
    isBot: player.role === "bot",
    score: player.score,
    activeDebuff: player.activeDebuff,
  }));

  const terminalMessages = eventLog.map((entry: EventLogEntry) => ({
    type: (entry.level === "error"
      ? "danger"
      : entry.level === "warning"
        ? "warning"
        : "info") as "info" | "success" | "warning" | "danger" | "system",
    content: entry.message,
    timestamp: new Date(entry.at).toLocaleTimeString(),
  }));

  // Handle minimap click - only allow clicking on alive players
  const handleMinimapClick = (targetPlayerId: string) => {
    const targetPlayer = playersPublic.find(
      (p) => p.playerId === targetPlayerId,
    );
    if (targetPlayer && targetPlayer.status !== "eliminated") {
      spectatePlayer(targetPlayerId);
    }
  };

  if (matchPhase === "ended") {
    return (
      <MatchResultsModal
        isOpen={true}
        endReason={matchEndResult?.endReason || "timeExpired"}
        standings={matchEndResult?.standings || []}
        selfPlayerId={playerId || ""}
        isHost={isHost}
        onReturnToLobby={() => router.push(`/lobby/${roomId}`)}
        onExit={() => router.push("/")}
      />
    );
  }

  return (
    <main className="flex h-screen flex-col p-2 overflow-hidden relative">
      <EffectsOverlay
        ddosActive={ddosActive}
        memoryLeakActive={memoryLeakActive}
      />

      {/* Eliminated Banner */}
      <div className="bg-error/20 border border-error text-error px-4 py-2 mb-1 flex items-center justify-between">
        <div className="font-mono font-bold text-sm flex items-center gap-4">
          <span className="text-lg">ELIMINATED</span>
          <span className="text-error/70 text-xs">
            Your Final Score: {score}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm font-mono flex items-center gap-2">
            <span className="text-error/70">Now watching:</span>
            <span className="text-primary font-bold text-base px-2 py-0.5 bg-primary/10 border border-primary/30 rounded">
              {spectateState?.username ?? "..."}
            </span>
            {spectateState && (
              <span className="text-muted text-xs">
                (Score: {spectateState.score})
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Top Bar */}
      <div className="flex items-center justify-between mb-1 px-1.5">
        <Timer
          endsAt={matchEndAt || new Date().toISOString()}
          serverTime={serverTime || new Date().toISOString()}
          variant="compact"
        />
        <div className="font-mono text-xs text-muted flex items-center gap-2 leading-none">
          <div>
            Room: <span className="text-primary">{roomId}</span>
            {!isConnected && (
              <span className="text-error animate-pulse ml-2">
                (Disconnected)
              </span>
            )}
          </div>
          <div className="text-[10px] uppercase tracking-widest">
            Spectating
            <span className="text-primary ml-2">
              {spectateState?.username ?? "--"}
            </span>
          </div>
          {activeDebuff && (
            <span
              className={`px-2 py-0.5 text-xs font-bold border ${
                activeDebuff.type === "ddos"
                  ? "border-error text-error animate-pulse"
                  : activeDebuff.type === "flashbang"
                    ? "border-warning text-warning"
                    : activeDebuff.type === "vimLock"
                      ? "border-success text-success"
                      : "border-warning text-warning"
              }`}
              data-text={`[${activeDebuff.type.toUpperCase()}]`}
            >
              [{activeDebuff.type.toUpperCase()}]
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          onClick={() => router.push("/")}
          className="px-2 py-1 text-xs"
        >
          Exit
        </Button>
      </div>

      {/* Main Layout */}
      <div className="flex flex-1 gap-1 min-h-0">
        {/* Left: Problem Panel */}
        <div className="flex-shrink-0 w-[320px]">
          {currentProblem ? (
            <ProblemDisplay
              problem={{
                title: currentProblem.title,
                difficulty: currentProblem.difficulty,
                prompt: currentProblem.prompt,
                signature:
                  currentProblem.problemType === "code"
                    ? (
                        currentProblem as Extract<
                          typeof currentProblem,
                          { problemType: "code" }
                        >
                      ).signature
                    : "",
                publicTests:
                  currentProblem.problemType === "code"
                    ? (
                        currentProblem as Extract<
                          typeof currentProblem,
                          { problemType: "code" }
                        >
                      ).publicTests.map((test) => ({
                        input: String(test.input ?? ""),
                        output: String(test.output ?? ""),
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
                selectedOptionId: undefined,
              }}
              testResults={[]}
            />
          ) : aliveTargets.length === 0 ? (
            <Panel title="PROBLEM" className="h-full">
              <div className="flex items-center justify-center h-full text-muted font-mono text-sm">
                No players left to spectate
              </div>
            </Panel>
          ) : (
            <Panel title="PROBLEM" className="h-full">
              <div className="flex items-center justify-center h-full text-muted font-mono text-sm animate-pulse">
                Loading spectate target...
              </div>
            </Panel>
          )}
        </div>

        {/* Center: Editor + Log */}
        <div className="flex-1 flex flex-col gap-1 min-w-0">
          <Panel
            title="EDITOR (READ-ONLY)"
            className="flex-1 min-h-0"
            noPadding
          >
            {currentProblem?.problemType === "mcq" ? (
              <div className="flex items-center justify-center h-full text-muted font-mono text-sm border-2 border-dashed border-secondary m-4">
                MCQ problem - no editor needed
              </div>
            ) : (
              <EditorWrapper
                code={spectateState?.code ?? ""}
                onChange={() => {}}
                language="python"
                readOnly
                className="h-full"
              />
            )}
          </Panel>

          <Panel title="TERMINAL LOG" className="h-40" noPadding>
            <TerminalLog messages={terminalMessages} />
          </Panel>

          <div className="flex items-center gap-3 p-2 border border-secondary bg-base-200 flex-shrink-0">
            <div className="font-mono text-sm text-error">
              Spectator Mode (Eliminated)
            </div>
            <div className="flex-1" />
            <div className="font-mono text-sm">
              Watching:{" "}
              <span className="text-accent">
                {spectateState?.username ?? "--"}
              </span>
            </div>
            <div className="font-mono text-sm">
              Score:{" "}
              <span className="text-accent">{spectateState?.score ?? 0}</span>
            </div>
            <div className="font-mono text-sm">
              Streak:{" "}
              <span className="text-accent">{spectateState?.streak ?? 0}</span>
            </div>
          </div>
        </div>

        {/* Right: Minimap + Stack */}
        <div className="w-64 flex-shrink-0 space-y-2 flex flex-col min-h-0">
          <Panel title="MINIMAP - Click to spectate" className="flex-shrink-0">
            <Minimap
              players={minimapPlayers}
              selfId={playerId || ""}
              spectatingId={activeTargetId || undefined}
              onPlayerClick={handleMinimapClick}
            />
          </Panel>

          <StackPanel
            stack={queued.map((problem, index) => ({
              id: `${problem.problemId}-${index}`,
              title: problem.title,
              difficulty: problem.difficulty,
              isGarbage: problem.isGarbage,
            }))}
            stackLimit={roomSettings?.stackLimit || 10}
            memoryLeakActive={memoryLeakActive}
            className="flex-1 min-h-0"
          />
        </div>
      </div>
    </main>
  );
}
