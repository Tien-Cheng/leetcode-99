import React, { useEffect, useState } from "react";
import { Trophy, Crown, LogOut, ArrowLeftRight, User, Bot } from "lucide-react";
import { Button } from "./button";

export interface StandingEntry {
    rank: number;
    playerId: string;
    username: string;
    role: "player" | "bot" | "spectator";
    score: number;
    status?: string;
}

export interface MatchResultsModalProps {
    isOpen: boolean;
    endReason: "lastAlive" | "timeExpired";
    standings: StandingEntry[];
    selfPlayerId?: string;
    isHost: boolean;
    onReturnToLobby: () => void;
    onExit: () => void;
}

export function MatchResultsModal({
    isOpen,
    endReason,
    standings,
    selfPlayerId,
    isHost,
    onReturnToLobby,
    onExit,
}: MatchResultsModalProps) {
    const [showPodium, setShowPodium] = useState(false);
    const [showStandings, setShowStandings] = useState(false);

    useEffect(() => {
        if (isOpen) {
            // Staggered reveal
            const podiumTimer = setTimeout(() => setShowPodium(true), 500);
            const standingsTimer = setTimeout(() => setShowStandings(true), 1500);
            return () => {
                clearTimeout(podiumTimer);
                clearTimeout(standingsTimer);
            };
        } else {
            setShowPodium(false);
            setShowStandings(false);
        }
    }, [isOpen]);

    // Keyboard support
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Enter" && isHost) {
                onReturnToLobby();
            } else if (e.key === "Escape") {
                onExit();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, isHost, onReturnToLobby, onExit]);

    if (!isOpen) return null;

    const winner = standings.find((s) => s.rank === 1);
    const second = standings.find((s) => s.rank === 2);
    const third = standings.find((s) => s.rank === 3);

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black p-4 overflow-y-auto font-mono">
            <div className="w-full max-w-4xl bg-[#0d0d0d] border border-[#4a5568] shadow-2xl p-8 min-h-[600px] flex flex-col gap-8 animate-in fade-in zoom-in duration-300">

                {/* Header */}
                <div className="text-center space-y-2">
                    <div className="flex items-center justify-center gap-3 text-[#00ffd5] animate-bounce">
                        <Trophy size={48} />
                        <h1 className="text-4xl font-bold tracking-tighter">MATCH ENDED</h1>
                        <Trophy size={48} />
                    </div>
                    <p className="text-[#6b7280] uppercase tracking-widest text-sm font-bold">
                        Reason: {endReason === "lastAlive" ? "Last Player Standing" : "Time Expired"}
                    </p>
                </div>

                {/* Podium */}
                <div className={`flex items-end justify-center gap-4 h-64 transition-all duration-700 ${showPodium ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
                    {/* 2nd Place */}
                    {second && (
                        <div className="flex flex-col items-center gap-2">
                            <div className="w-32 bg-[#1a1a1a] border-t-4 border-slate-400 p-4 text-center shadow-lg h-32 flex flex-col justify-end">
                                <div className="text-sm truncate w-full" title={second.username}>{second.username}</div>
                                <div className="text-xl font-bold">{second.score}</div>
                                <div className="text-slate-400 text-xs uppercase">2nd</div>
                            </div>
                        </div>
                    )}

                    {/* 1st Place */}
                    {winner && (
                        <div className="flex flex-col items-center gap-2">
                            <Crown className="text-yellow-400 animate-pulse" size={40} />
                            <div className="w-40 bg-[#1a1a1a] border-t-4 border-yellow-400 p-6 text-center shadow-[0_0_30px_rgba(250,204,21,0.3)] h-48 flex flex-col justify-end">
                                <div className="text-lg font-bold truncate w-full" title={winner.username}>{winner.username}</div>
                                <div className="text-3xl font-black text-yellow-500">{winner.score}</div>
                                <div className="text-yellow-400 text-sm uppercase font-bold tracking-widest">Winner</div>
                            </div>
                        </div>
                    )}

                    {/* 3rd Place */}
                    {third && (
                        <div className="flex flex-col items-center gap-2">
                            <div className="w-28 bg-[#1a1a1a] border-t-4 border-amber-700 p-4 text-center shadow-lg h-24 flex flex-col justify-end">
                                <div className="text-sm truncate w-full" title={third.username}>{third.username}</div>
                                <div className="text-lg font-bold">{third.score}</div>
                                <div className="text-amber-700 text-xs uppercase">3rd</div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Standings Table */}
                <div className={`flex-1 transition-all duration-700 delay-500 ${showStandings ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
                    <div className="border border-[#4a5568] bg-[#1a1a1a]">
                        <div className="bg-[#0d0d0d] p-2 border-b border-[#4a5568] text-xs font-bold flex justify-between uppercase tracking-widest text-[#6b7280]">
                            <span>Match Standings</span>
                            <span>{standings.length} Players</span>
                        </div>
                        <div className="max-h-64 overflow-y-auto overflow-x-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 bg-[#0d0d0d]">
                                    <tr className="border-b border-[#4a5568] text-[#6b7280] text-[10px] uppercase">
                                        <th className="p-2 w-12 text-center">#</th>
                                        <th className="p-2">Player</th>
                                        <th className="p-2 text-right">Score</th>
                                        <th className="p-2 text-right">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm">
                                    {standings.map((entry) => (
                                        <tr
                                            key={entry.playerId}
                                            className={`hover:bg-[#4a5568]/10 border-b border-[#4a5568]/30 ${entry.playerId === selfPlayerId ? "bg-[#00ffd5]/10 text-[#00ffd5]" : "text-[#e0e0e0]"}`}
                                        >
                                            <td className="p-2 text-center font-bold">{entry.rank}</td>
                                            <td className="p-2">
                                                <div className="flex items-center gap-2">
                                                    {entry.role === "bot" ? <Bot size={14} className="text-orange-400" /> : <User size={14} />}
                                                    <span className="truncate max-w-[150px]">{entry.username}</span>
                                                    {entry.playerId === selfPlayerId && <span className="text-[10px] border border-[#00ffd5] px-1 ml-1 whitespace-nowrap">YOU</span>}
                                                </div>
                                            </td>
                                            <td className="p-2 text-right font-bold">{entry.score}</td>
                                            <td className="p-2 text-right text-[10px] uppercase">
                                                {entry.status === "Eliminated" ? (
                                                    <span className="text-red-500">Eliminated</span>
                                                ) : (
                                                    <span className="text-[#50fa7b]">Survived</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-[#4a5568]">
                    <div className="flex flex-wrap gap-4 justify-center sm:justify-start">
                        {isHost ? (
                            <Button
                                variant="primary"
                                onClick={onReturnToLobby}
                                hotkey="Enter"
                            >
                                <ArrowLeftRight size={18} className="mr-2" />
                                Return to Lobby
                            </Button>
                        ) : (
                            <div className="flex items-center gap-3 text-[#6b7280] animate-pulse">
                                <ArrowLeftRight size={18} />
                                <span className="text-xs uppercase font-bold tracking-wider">Waiting for host to reset...</span>
                            </div>
                        )}
                        <Button
                            variant="secondary"
                            onClick={onExit}
                            hotkey="Esc"
                        >
                            <LogOut size={18} className="mr-2" />
                            Exit to Menu
                        </Button>
                    </div>

                    <div className="text-right hidden sm:block">
                        <div className="text-[10px] text-[#6b7280] uppercase">Match ID</div>
                        <div className="text-[10px] text-[#6b7280]/50 break-all">LEET99-RESULTS-AUTH</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
