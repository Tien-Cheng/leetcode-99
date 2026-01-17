"use client";

import { useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
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
import { SpectateWrapper } from "./spectate-wrapper";

function SpectatePageContent({ roomId }: { roomId: string }) {
  const router = useRouter();
  const {
    isConnected,
    playersPublic,
    spectateState,
    spectatePlayer,
    stopSpectate,
    eventLog,
    matchPhase,
    matchEndAt,
    matchEndResult,
    serverTime,
    isHost,
    roomSettings,
    playerId,
  } = useGameState();

  const targets = useMemo(
    () =>
      playersPublic.filter(
        (player: PlayerPublic) =>
          player.role !== "spectator" && player.status !== "lobby",
      ),
    [playersPublic],
  );

  const activeTargetId = spectateState?.playerId ?? null;

  useEffect(() => {
    if (
      activeTargetId &&
      !targets.some(
        (target: PlayerPublic) => target.playerId === activeTargetId,
      )
    ) {
      stopSpectate();
    }
  }, [activeTargetId, targets, stopSpectate]);

  useEffect(() => {
    if (!activeTargetId && targets.length > 0) {
      spectatePlayer(targets[0].playerId);
    }
  }, [activeTargetId, targets, spectatePlayer]);

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

  const minimapPlayers = targets.map((player: PlayerPublic) => ({
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

      {/* Top Bar */}
      <div className="flex items-center justify-between mb-2 px-2">
        <Timer
          endsAt={matchEndAt || new Date().toISOString()}
          serverTime={serverTime || new Date().toISOString()}
        />
        <div className="font-mono text-sm text-muted flex items-center gap-3">
          <div>
            Room: <span className="text-primary">{roomId}</span>
            {!isConnected && (
              <span className="text-error animate-pulse ml-2">
                (Disconnected)
              </span>
            )}
          </div>
          <div className="text-xs uppercase tracking-widest">
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
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => stopSpectate()}
            disabled={!activeTargetId}
          >
            Stop
          </Button>
          <Button variant="ghost" onClick={() => router.push("/")}>
            Exit
          </Button>
        </div>
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
          ) : (
            <Panel title="PROBLEM" className="h-full">
              <div className="flex items-center justify-center h-full text-muted font-mono text-sm animate-pulse">
                Waiting for spectate target...
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
            <div className="font-mono text-sm text-muted">Spectator Mode</div>
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
          <Panel title="MINIMAP" className="flex-shrink-0">
            <Minimap
              players={minimapPlayers}
              selfId={playerId || ""}
              spectatingId={activeTargetId || undefined}
              onPlayerClick={(id) => spectatePlayer(id)}
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

export default function SpectatePage() {
  const params = useParams();
  const roomId = params.roomId as string;

  return (
    <SpectateWrapper roomId={roomId}>
      <SpectatePageContent roomId={roomId} />
    </SpectateWrapper>
  );
}
