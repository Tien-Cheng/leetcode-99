# AGENTS.md

This file is for agentic coding tools operating in this repository.

`CLAUDE.md` is a symlink to this file (edit either one).

## Repo status

- This repo currently contains planning docs only under `docs/` (no app code yet).
- Treat the docs as source-of-truth until code exists.

## Product + architecture (planned)

- Product: **Leet99** — battle‑royale coding game (function-only Python problems).
- Monorepo layout:
  - `apps/web` — Next.js (App Router) frontend + API routes
  - `packages/contracts` — shared types/schemas (source of truth)
  - `packages/realtime` — PartyKit realtime layer
  - `packages/judge` — Judge0 integration
  - `packages/supabase` — Supabase helpers
  - `packages/ui` — shared UI components
  - `packages/config` — shared lint/tsconfig/etc.

## Toolchain targets (planned)

- Node **24**, pnpm **10.10**, TypeScript **5.9**, Turbo **2.5**
- ESLint **9** (flat config), Prettier **3.8**
- Next **16.1**, React **19**
- Tailwind **v4** + daisyUI **v5**

## Ground rules (non-negotiable)

- **Contracts-first**: update `packages/contracts` before changing API/UI.
- **Server authoritative**: clients render state; server validates game rules.
- **No secrets in browser**: never ship service keys or Judge0 keys client-side.
- **No drive-by refactors**: keep diffs narrowly scoped to the task.

## Commands (once scaffolded)

Because there is no root `package.json` yet, treat these as intended commands and
adjust once scripts land.

- Install: `pnpm install`
- Dev: `pnpm dev` (or `pnpm turbo dev`, filter: `pnpm turbo dev --filter=apps/web`)
- Build: `pnpm build` (or `pnpm turbo build`)
- Lint: `pnpm lint` (or `pnpm turbo lint`)
- Typecheck: `pnpm typecheck` (or `pnpm turbo typecheck`)
- Format: `pnpm format` (write), `pnpm format:check` (check)
- Discover scripts: `cat package.json`, `pnpm -r run`, `pnpm turbo run --help`

## Tests (especially single test)

Runner not committed yet; prefer one standard (e.g. Vitest) when adding tests.

- All tests: `pnpm test` (or `pnpm turbo test`)
- Filter one package (Turbo): `pnpm turbo test --filter=packages/contracts`

Run a single test file / test name (use the runner you actually adopt):

- Vitest: `pnpm vitest path/to/foo.test.ts`, `pnpm vitest path/to/foo.test.ts -t "test name"`
- Jest: `pnpm jest path/to/foo.test.ts`, `pnpm jest path/to/foo.test.ts -t "test name"`
- Playwright: `pnpm playwright test path/to/spec.spec.ts`, `pnpm playwright test -g "test name"`

## API + realtime conventions

- Next.js API routes: `apps/web/app/api/**/route.ts`.
- Handlers should be thin: validate → call domain service → return response.
- Canonical endpoints:
  - `POST /api/rooms`
  - `POST /api/rooms/:roomId/join`
- Standard error shape:
  - `{ "error": { "code": string, "message": string, "details"?: unknown } }`

Realtime envelope (all WS messages):

- `type WSMessage = { type: string; requestId?: string; payload: unknown }`
- Always include `requestId` for request/response pairs.
- Prefer a single `type` registry in `packages/contracts`.

Data conventions:

- JSON keys: camelCase
- Timestamps: ISO 8601 UTC
- Identifiers: `roomId`, `matchId`, `playerId`, `problemId`
- `playerToken` is a secret; treat like a password.
- Never send `hiddenTests` to clients (only server/judge).

## Security + config

Planned env vars (do not hardcode):

- Public (OK in browser): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Server-only: `SUPABASE_SERVICE_ROLE_KEY`, `JUDGE0_URL`, `JUDGE0_API_KEY`, `PARTYKIT_HOST`, `PARTYKIT_PROJECT`

## Code style (agent-facing)

TypeScript:

- Prefer strict typing; avoid `any`.
- Prefer `unknown` + narrowing.
- Use `import type { Foo } from "..."` for type-only imports.
- Prefer `type` aliases for cross-boundary shapes; use `interface` only when merging is needed.

Formatting:

- Let Prettier (and ESLint) be the source of truth; don’t hand-format against it.

Imports:

- Group imports: (1) node/builtins (2) external (3) workspace packages (4) relative.
- Keep ordering deterministic; sort within groups when feasible.

Naming:

- Variables/functions: `camelCase`
- Types/classes/components: `PascalCase`
- Files: `kebab-case.ts` (unless local convention differs)
- Booleans: `isX`, `hasX`, `canX`

Error handling:

- Use explicit error codes (stable strings) and avoid leaking secrets.
- API handlers should validate early and return the standard error shape.
- Use appropriate HTTP statuses (400/401/403/404/409/429/500).

Logging:

- Server-side only.
- Include `roomId`/`matchId`/`playerId`/`requestId` when relevant.
- Avoid logging whole payloads if they may contain secrets.

## UI guidelines (planned)

- Style: “riced workstation” game UI (dense/kinetic), not SaaS.
- Desktop-only MVP; keyboard-first interactions.
- Fonts: IBM Plex Sans + IBM Plex Mono.
- Tailwind v4 + daisyUI v5; theme `leet99` + optional `leet99-flashbang`.
- Icons: Lucide only.

## Cursor/Copilot instructions

- Checked: `.cursor/rules/`, `.cursorrules`, `.github/copilot-instructions.md`
- Status: none found in this repo (update this section if added).

## Canonical docs (source of truth)

- `docs/Design Document.md`
- `docs/Backend API Spec.md`
- `docs/Frontend UI Spec.md`
- `docs/Implementation Plan (AI Agents).md`
