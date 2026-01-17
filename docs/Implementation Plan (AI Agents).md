---
title: LeetCode 99 Implementation Plan (AI Agents)
tags: [HackAndRoll2026, LeetCode99, implementation, monorepo, agents]
---

# LeetCode 99 — Implementation Plan (AI Agents)

This document is **for AI coding agents** (and humans supervising them). It is designed to prevent common failures:

- using outdated/incorrect package versions
- scattering code across inconsistent directories
- mixing obsolete framework patterns (e.g. old Tailwind/Next.js patterns)
- breaking shared contracts (WS payloads, state shapes)
- “drive-by refactors” that cause merge conflicts

It is intentionally **hackathon-friendly**: clean, consistent, but not over-engineered.

## 0) Golden Rules (Read First)

1. **Contracts first**: `packages/contracts` is the source of truth for HTTP + WS payloads.
2. **No drive-by refactors**: do not rename exports, folders, or types unless explicitly tasked.
3. **One primary area per task**: pick **one** of `apps/web` or a single `packages/*` as the main work area.
   - You may also touch a small number of **direct dependency** files if strictly necessary (e.g. a UI change requires a contract type import), but don’t expand scope.
4. **Pin versions**: don’t “upgrade while you work”. If a version bump is needed, do it as its own task.
5. **Server is authoritative**: PartyKit room state decides truth; clients render it.
6. **No secrets in the browser**: Judge0 and Supabase service role keys are server-only.
7. **If ambiguous, stop and ask**: do not guess at message names, env var names, or security decisions.

## 1) Canonical Stack (Pinned Versions)

Agents MUST use these versions unless explicitly told otherwise.

Operational rule (prevents thrash): if the real code repo already has a lockfile (e.g. `pnpm-lock.yaml`), the lockfile wins. Do not change dependency versions unless the task explicitly asks for a version bump.

**Runtime + tooling**

- Node: `24.x` (LTS)
- pnpm: `10.10.x`
- TypeScript: `5.9.x`
- Turbo: `2.5.x`
- ESLint: `9.x` (Flat Config)
- Prettier: `3.8.x`

**Frontend / Next.js**

- Next.js: `16.1.x` (App Router)
- React: `19.x`
- Tailwind CSS: `4.1.x`
- daisyUI: `5.x` (Tailwind v4)
- Icons: `lucide-react@0.56.x`
- Monaco: `monaco-editor@0.55.x`
- Monaco React wrapper: `@monaco-editor/react@4.7.0` (default)
  - If React 19 breaks types/build, use `@monaco-editor/react@4.7.0-rc.0` (explicitly pinned)
- Vim: `monaco-vim@0.4.x`

**Realtime / Backend**

- PartyKit: `partykit@0.0.115` (pin exactly; 0.x may break)
- Zod: `4.3.x` (runtime schemas + inferred TS types)

**Persistence**

- Supabase JS: `@supabase/supabase-js@2.90.x`

**Sandbox execution**

- Judge0 Extra CE: `1.13.1-extra` (pinned; upgrade only as an explicit task)
- Pyodide (client RUN_CODE): `0.29.x` (lazy-loaded; public tests only)

### 1.1 Why these constraints exist

- **daisyUI v5** expects **Tailwind v4** (use the v4 CSS-first setup).
- **Next 16 + React 19**: avoid older Next 13/14 tutorials and older React patterns.
- **PartyKit 0.x**: avoid unreviewed `^` upgrades.
- **Judge0 is Remote Code Execution**: treat it as hostile-by-default infrastructure.

### 1.2 Compatibility guardrails (common agent mistakes)

- **Tailwind v4 config**: do not use Tailwind v3 directives like `@tailwind base;`.
- **Next.js endpoints**: do not create `pages/api/*` (App Router only).
- **React 19**: avoid old guidance about `React.FC` everywhere; prefer explicit props typing.
- **Monaco**: always lazy-load; do not mount Monaco on landing/lobby.
- **PartyKit**: pin `partykit` exactly and avoid breaking API churn mid-hackathon.

## 2) Monorepo Layout (Hard Rules)

Use pnpm workspaces + Turborepo. The goal is simple boundaries + easy parallel work.

```text
repo/
  apps/
    web/                 # Next.js app (UI + HTTP routes)
  packages/
    contracts/           # Shared types + zod schemas (SOURCE OF TRUTH)
    realtime/            # PartyKit room implementation
    judge/               # Judge0 adapter + test running utilities
    supabase/            # DB helpers + typed queries (no UI)
    ui/                  # Pure UI components (no networking)
    config/              # shared eslint/tsconfig/prettier configs
  infra/
    judge0/              # Judge0 docker compose / deployment notes
  scripts/               # repo scripts (optional)
```

### 2.1 Ownership boundaries

- `packages/contracts`: only change if your task is “contract change”.
- `packages/realtime`: authoritative game logic + state machine.
- `apps/web`: UI + route handlers only. Do not put game logic here.
- `packages/ui`: dumb components (props in, render out). No WebSocket here.

### 2.2 Path conventions

- Server-only code MUST NOT be imported into client bundles.
- Next.js:
  - UI pages: `apps/web/app/**`
  - HTTP endpoints: `apps/web/app/api/**/route.ts`
  - Shared UI components: `apps/web/src/components/**` (or in `packages/ui`)

### 2.3 Local dev topology (expected)

```text
Browser
  ↕ (HTTP)
apps/web (Next.js)
  - POST /api/rooms
  - POST /api/rooms/:roomId/join
  ↕ (WS)
packages/realtime (PartyKit room)
  ↕ (HTTP, server-to-server)
Judge0 (exec)         Supabase (persist)
```

Principle: the browser only talks to **Next.js HTTP** and **PartyKit WS**. Anything requiring secrets (Judge0, Supabase service role) is server-side only.

### 2.4 Environment variables (name these exactly in the real repo)

Agents often fail because env var names drift. When bootstrapping the real code repo, add an `.env.example` and keep it updated.

**Public (safe for browser, `NEXT_PUBLIC_*`)**

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Server-only (Next.js + PartyKit runtime)**

- `SUPABASE_SERVICE_ROLE_KEY` (optional; only if server needs privileged writes)
- `JUDGE0_URL` (e.g. `https://judge0.example.com`)
- `JUDGE0_API_KEY` (canonical; no alternative names)
- `PARTYKIT_HOST` (e.g. `https://<your>.partykit.dev`)
- `PARTYKIT_PROJECT` (e.g. `leetcode99`; this becomes `/parties/<project>/<roomId>`)

Hard rule: do not expose any server-only env var to the browser.

## 3) “Interface-First” Contract Discipline

All realtime messages must use a single envelope:

```ts
// packages/contracts/src/ws.ts
export type WSMessage<TType extends string, TPayload> = {
  type: TType;
  requestId?: string;
  payload: TPayload;
};
```

### 3.1 Zod schemas are mandatory at boundaries

- Every Client→Server and Server→Client payload must have a Zod schema.
- Derive TS types from schemas: `z.infer<typeof Schema>`.
- Never “hand-wave” with `any` at the network boundary.

### 3.2 Canonical WS message types (MVP — complete list)

Agents MUST NOT invent new message type strings. Use these exact uppercase `type` values.

If you believe a new WS event is needed, stop and ask for approval before adding it (contract changes ripple everywhere).

Client → Server (MVP)

- `JOIN_ROOM`
- `SET_TARGET_MODE`
- `UPDATE_SETTINGS`
- `START_MATCH`
- `RETURN_TO_LOBBY`
- `ADD_BOTS`
- `SEND_CHAT`
- `RUN_CODE`
- `SUBMIT_CODE`
- `SPEND_POINTS`
- `SPECTATE_PLAYER`
- `STOP_SPECTATE`
- `CODE_UPDATE`

Server → Client (MVP)

- `ROOM_SNAPSHOT`
- `SETTINGS_UPDATE`
- `MATCH_STARTED`
- `MATCH_PHASE_UPDATE`
- `PLAYER_UPDATE`
- `JUDGE_RESULT`
- `STACK_UPDATE`
- `CHAT_APPEND`
- `ATTACK_RECEIVED`
- `EVENT_LOG_APPEND`
- `SPECTATE_STATE`
- `CODE_UPDATE`
- `MATCH_END`
- `ERROR`

### 3.3 Anti-patterns (do not do these)

- Duplicating “almost the same” types in UI and realtime.
- Adding fields to payloads without updating schemas.
- Using snake_case in JSON payloads (the spec is camelCase).

## 4) Next.js (apps/web) Rules

### 4.1 App Router only

- Implement endpoints in `app/api/**/route.ts` exporting `GET/POST/...`.
- Use `NextRequest`/`NextResponse` from `next/server`.

Example:

```ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  return NextResponse.json({ ok: true }, { status: 200 });
}
```

### 4.1.1 Canonical HTTP contracts (MVP summary)

Do not improvise HTTP payload shapes; keep them aligned to the Backend API Spec.

- `POST /api/rooms`
  - request: `{ username: string, settings?: Partial<RoomSettings> }`
  - response: `{ roomId: string, wsUrl: string, playerId: string, playerToken: string, role: "player", isHost: true, settings: RoomSettings }`
- `POST /api/rooms/:roomId/join`
  - request: `{ username: string, role: "player" | "spectator" }`
  - response: `{ roomId: string, wsUrl: string, playerId: string, playerToken: string, role: "player" | "spectator", isHost: boolean, settings: RoomSettings }`
- error shape (HTTP): `{ error: { code: string, message: string, details?: object } }`

If an agent needs a new endpoint, it must first propose the contract and update `packages/contracts`.

### 4.2 Environment variables

- Browser-safe values only as `NEXT_PUBLIC_*`.
- Supabase service role key MUST be server-only.
- Judge0 endpoint keys/headers MUST be server-only.

### 4.3 HTTP routes should be thin

- Route handlers orchestrate:
  - validate request
  - call `packages/realtime` (if needed) or DB helpers
  - return response
- They should NOT embed game logic.

## 5) PartyKit Realtime (packages/realtime)

### 5.1 Server is authoritative

- The PartyKit room owns:
  - player roster + host transfer
  - match lifecycle (lobby → warmup → main → ended)
  - stacks/current problem state
  - scoring, streaks
  - attacks/debuffs and timers

### 5.2 Determinism + ordering

- PartyKit serializes messages per room; use that ordering.
- Timers should be managed server-side and expressed as ISO timestamps (`endsAt`).
- Avoid client-side “guessing” that affects outcomes.

### 5.3 Payload size + throttling

- Respect spec caps:
  - `CODE_UPDATE` <= 50_000 bytes
  - throttle `CODE_UPDATE` (max 10/s)
- Spectator code streaming is expensive; degrade gracefully:
  - prefer snapshots
  - send code updates only to authorized spectators

### 5.4 Secrets + anti-patterns

- PartyKit code runs server-side, so it MAY call Judge0 / Supabase using secrets, but:
  - never hardcode secrets in git
  - never send secrets to clients (including in error messages)
  - never log full request bodies containing code + tokens
- Do not let clients mutate public state directly.
- Do not use client time for anything outcome-determining.

## 6) Judge / Execution (packages/judge + infra/judge0)

### 6.1 Execution modes

- `RUN_CODE`:
  - Prefer client-side Pyodide (public tests only)
  - Optional fallback: server executes public tests only
- `SUBMIT_CODE`:
  - Server executes public + hidden tests using Judge0 (authoritative)

### 6.2 Security rules (non-negotiable)

- Treat Judge0 as RCE.
- Do NOT expose Judge0 publicly without auth/IP allowlist.
- Never pass user code to a third-party endpoint without an explicit decision.

### 6.3 Adapter expectations

- Adapter functions (conceptual):
  - `runPublicTests(problem, code)` → `JudgeResult`
  - `runAllTests(problem, code)` → `JudgeResult`
- Hidden test failures must be opaque:
  - return `hiddenTestsPassed=false` and `hiddenFailureMessage="Failed hidden tests"`

### 6.4 Canonical `JudgeResult` shape (MVP)

Keep this aligned with the Backend API Spec:

```ts
type PublicTestResult = {
  index: number;
  passed: boolean;
  expected?: unknown;
  received?: unknown;
  stdout?: string;
  stderr?: string;
  error?: string;
};

type JudgeResult = {
  kind: "run" | "submit";
  problemId: string;
  passed: boolean;
  publicTests: PublicTestResult[];
  runtimeMs?: number;
  hiddenTestsPassed?: boolean;
  hiddenFailureMessage?: string;
};
```

Rule: `RUN_CODE` must only populate public test details; `SUBMIT_CODE` may set `hiddenTestsPassed` but never include hidden case data.

## 7) Supabase (packages/supabase)

### 7.1 Scope

- MVP persistence: `matches` + `match_players` for end screen + leaderboard.
- Avoid premature “accounts” work.

### 7.2 Key handling

- Browser uses **anon** key only.
- Server uses service role key only if needed.
- Never ship service role key to client.

## 8) UI Implementation Rules (Riced Workstation)

These rules exist because agents often produce generic “template UI”. Do not.

### 8.1 Non-negotiable aesthetic constraints (from UI spec)

- No Inter/Roboto/system UI fonts.
- IBM Plex Sans + IBM Plex Mono only (MVP).
- Sharp borders; near-zero radii.
- Dense layout; no decorative whitespace.
- Avoid SaaS patterns (rounded cards, hero sections, marketing navbar).

### 8.2 Tailwind v4 + daisyUI v5 setup

In your global CSS:

```css
@import "tailwindcss";
@plugin "daisyui";
```

For theme(s), define `leet99` and `leet99-flashbang` using daisyUI theme plugin. Keep radii tiny and depth off.

### 8.3 Component boundaries

- `packages/ui` components are **pure**:
  - props-only, no direct WebSocket calls
- `apps/web` binds state to UI.

### 8.4 Monaco editor

- Lazy-load Monaco to reduce initial bundle impact.
- Default focus on editor in-game.
- Vim mode:
  - toggle via `Alt/Option+V`
  - forced during debuff `vimLock`

### 8.5 Anti-patterns

- Adding another icon library.
- Using daisyUI `card`/`navbar` defaults without heavy customization.
- Building UI state that contradicts server snapshot.

## 9) Project-wide Style + Quality Gates

### 9.1 TypeScript strictness

- `strict: true`.
- Avoid `any`.
- If you must use assertions, confine to parsing/validation layers.

### 9.2 Lint/format

- Prefer ESLint v9 Flat Config (`eslint.config.js`).
- Format with Prettier; do not reformat unrelated files.

### 9.3 Testing philosophy (hackathon)

- Add tests only where they save time:
  - contract schema tests
  - judge adapter tests (pure functions)
  - targeting algorithm tests
- Avoid UI snapshot-test rabbit holes.

## 10) Agent Task Contract (How to Work Safely)

When you are assigned a task, your output should include:

- what files you touched
- what contract types/events were affected (if any)
- how to validate (commands)

### 10.1 Allowed changes

- Implement a feature behind existing contracts.
- Add small helper utilities local to your package.

### 10.2 Not allowed without explicit approval

- Renaming message types or payload fields.
- Moving folders.
- Replacing libraries (e.g., “let’s use Zustand instead”).
- Large formatting changes across many files.

## 11) Minimal Command Set (Expected)

Agents should assume the repo supports:

- `pnpm i`
- `pnpm dev` (starts `apps/web` and any required packages)
- `pnpm lint`
- `pnpm format`
- `pnpm typecheck`

(Actual scripts should be aligned to this during repo bootstrap.)

### 11.1 Bootstrap checklist (for the first agent)

Goal: get to “two browsers can create/join lobby” as fast as possible.

1. Pin toolchain
   - add `.nvmrc` with `24`
   - add `packageManager` field to root `package.json` (pnpm 10.10.x)
2. Scaffold monorepo
   - create `apps/web` with Next.js 16 App Router
   - create `packages/contracts` first (envelope + Zod schemas)
3. Wire dev scripts
   - `pnpm dev` should run web + realtime in parallel (Turbo)
4. Add `.env.example`
   - include every env var listed in section 2.4
5. Bring up dev dependencies
   - Supabase: either remote project or local dev stack
   - Judge0: local docker compose in `infra/judge0` OR point to hosted endpoint
6. Validate manually (MVP)
   - create room via `POST /api/rooms`
   - join room via `POST /api/rooms/:roomId/join`
   - open WS to PartyKit and receive `ROOM_SNAPSHOT`

Hard rule: if any of the above is unclear in the code repo, stop and ask rather than guessing.

## 12) Known Footguns (Read This Twice)

- **Tailwind v4** is not Tailwind v3: don’t use `@tailwind base;` etc.
- **Next 16 App Router**: don’t create `pages/api/*`.
- **ESLint v9**: don’t add `.eslintrc` unless the repo explicitly uses legacy.
- **PartyKit 0.x**: don’t casually upgrade.
- **Judge0**: do not run open unauth endpoints.
- **Supabase**: never expose service role key.

---

# Appendix A — “Starter Prompt” for AI Agents

```text
You are an AI coding agent working on LeetCode 99.

Task:
- <describe in 1–2 sentences>

Constraints:
- Only modify files under: <one directory>
- Do not rename exports or change contracts unless instructed.
- Follow pinned versions and monorepo layout.

Deliverables:
- <bullets>

Acceptance:
- <bullets>
```
