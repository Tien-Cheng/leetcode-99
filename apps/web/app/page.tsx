import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      {/* Title */}
      <div className="text-center">
        <h1 className="font-mono text-5xl font-bold tracking-tight text-primary drop-shadow-[0_0_10px_var(--color-primary)]">
          LEET99
        </h1>
        <p className="mt-2 font-mono text-sm text-base-content/60">
          Battle Royale for Coders
        </p>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3">
        <Link
          href="/create"
          className="btn btn-outline btn-primary min-w-64 font-mono"
          accessKey="c"
        >
          <span className="kbd kbd-sm mr-2">C</span>
          Create Room
        </Link>
        <Link
          href="/join"
          className="btn btn-outline min-w-64 font-mono"
          accessKey="j"
        >
          <span className="kbd kbd-sm mr-2">J</span>
          Join Room
        </Link>
      </div>

      {/* Help link */}
      <button
        className="btn btn-ghost btn-sm font-mono text-base-content/40"
        accessKey="?"
      >
        <span className="kbd kbd-xs mr-1">?</span>
        How to Play
      </button>

      {/* Version */}
      <p className="fixed bottom-4 right-4 font-mono text-xs text-base-content/30">
        v0.1.0
      </p>
    </main>
  );
}
