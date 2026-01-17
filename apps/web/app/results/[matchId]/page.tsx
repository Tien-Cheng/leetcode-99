"use client";

import { useParams, useRouter } from "next/navigation";
import { Button, Panel } from "@leet99/ui";

export default function ResultsPage() {
  const params = useParams();
  const router = useRouter();
  const matchId = params.matchId as string;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="w-full max-w-5xl space-y-6">
        {/* Winner Announcement */}
        <div className="text-center space-y-4">
          <h1 className="font-mono text-4xl text-warning">🏆 WINNER 🏆</h1>

          {/* Podium */}
          <div className="flex items-end justify-center gap-4 mt-8">
            {/* 2nd Place */}
            <div className="w-32 text-center">
              <div className="border-2 border-secondary bg-base-200 p-4 h-24 flex flex-col items-center justify-center">
                <div className="font-mono text-lg">bob</div>
                <div className="font-mono text-sm text-muted">95 pts</div>
              </div>
              <div className="font-mono text-xs text-muted mt-1">2nd</div>
            </div>

            {/* 1st Place */}
            <div className="w-32 text-center">
              <div className="border-2 border-warning bg-warning/10 p-4 h-32 flex flex-col items-center justify-center glow-success">
                <div className="font-mono text-xl text-warning">alice</div>
                <div className="font-mono text-sm">120 pts</div>
              </div>
              <div className="font-mono text-sm text-warning mt-1">1st</div>
            </div>

            {/* 3rd Place */}
            <div className="w-32 text-center">
              <div className="border-2 border-secondary bg-base-200 p-4 h-20 flex flex-col items-center justify-center">
                <div className="font-mono">charlie</div>
                <div className="font-mono text-sm text-muted">80 pts</div>
              </div>
              <div className="font-mono text-xs text-muted mt-1">3rd</div>
            </div>
          </div>
        </div>

        {/* Standings Table */}
        <Panel title="STANDINGS">
          <table className="w-full font-mono text-sm">
            <thead>
              <tr className="border-b border-secondary">
                <th className="text-left py-2">#</th>
                <th className="text-left py-2">Player</th>
                <th className="text-right py-2">Score</th>
                <th className="text-right py-2">Solved</th>
                <th className="text-right py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-secondary/50">
                <td className="py-2">1</td>
                <td className="py-2">alice</td>
                <td className="text-right py-2">120</td>
                <td className="text-right py-2">12</td>
                <td className="text-right py-2 text-success">Survived</td>
              </tr>
              <tr className="border-b border-secondary/50">
                <td className="py-2">2</td>
                <td className="py-2">bob</td>
                <td className="text-right py-2">95</td>
                <td className="text-right py-2">9</td>
                <td className="text-right py-2 text-success">Survived</td>
              </tr>
              <tr className="border-b border-secondary/50">
                <td className="py-2">3</td>
                <td className="py-2">charlie</td>
                <td className="text-right py-2">80</td>
                <td className="text-right py-2">8</td>
                <td className="text-right py-2 text-success">Survived</td>
              </tr>
              <tr className="border-primary">
                <td className="py-2">4</td>
                <td className="py-2 text-accent">you ◀</td>
                <td className="text-right py-2">65</td>
                <td className="text-right py-2">6</td>
                <td className="text-right py-2 text-error">Eliminated #4</td>
              </tr>
            </tbody>
          </table>
        </Panel>

        {/* Match Summary */}
        <div className="grid grid-cols-2 gap-4">
          <Panel title="YOUR STATS">
            <div className="space-y-2 font-mono text-sm">
              <div>Problems: 2E / 3M / 1H</div>
              <div>Accuracy: 6/9 (67%)</div>
              <div>Best Streak: 4</div>
              <div>Time Survived: 8:32</div>
            </div>
          </Panel>

          <Panel title="MATCH SUMMARY">
            <div className="space-y-2 font-mono text-sm">
              <div>Duration: 10:00</div>
              <div>End: Time expired</div>
              <div>Total solved: 39 problems</div>
              <div>Players: 4</div>
            </div>
          </Panel>
        </div>

        {/* Actions */}
        <div className="flex justify-center gap-4">
          <Button variant="primary" hotkey="Enter" onClick={() => router.push("/")}>
            Return to Lobby
          </Button>
          <Button variant="ghost" hotkey="Esc" onClick={() => router.push("/")}>
            Exit
          </Button>
        </div>
      </div>
    </main>
  );
}
