# PartyKit-backed Create/Join Rooms Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make `POST /api/rooms` and `POST /api/rooms/:roomId/join` fully backed by PartyKit room state (no mock data), using `packages/realtime/src/room.ts` as the authoritative store for room existence, settings, player roster, and join constraints.

**Architecture:** Next.js API routes remain thin (validate → generate ids/tokens → call PartyKit room HTTP endpoint → return HTTP response). PartyKit room server becomes authoritative for room existence, username uniqueness, player cap, and lobby-only player joins. Next.js never directly mutates PartyKit state; it performs a single server-to-server `register` call that either succeeds or returns a canonical error code.

**Tech Stack:** Next.js Route Handlers, PartyKit `onRequest` endpoints + durable storage, `@leet99/contracts` (Zod + types), server-to-server `fetch`.

## Preconditions / Notes

- Requires env vars (dev defaults are ok):
  - `PARTYKIT_HOST` (e.g. `http://localhost:1999`)
  - `PARTYKIT_PROJECT` (e.g. `leet99`)
- Important PartyKit behavior: a request to a non-existent room ID will _create_ a room instance. To preserve `ROOM_NOT_FOUND`, the room state must track whether it has been "created" by the host create flow.

---

### Task 1: Add contracts for PartyKit register bridge

**Files:**

- Modify: `packages/contracts/src/http.ts`
- Modify: `packages/contracts/src/index.ts` (if needed for exports)

**Step 1: Write the failing “typecheck” expectation**

Add a temporary TypeScript file to validate imports (delete once done):

- Create: `packages/contracts/src/__tmp_register_types_check.ts`

```ts
import type { PartyRegisterRequest, PartyRegisterResponse } from "./http";

const req: PartyRegisterRequest = {
  playerId: "p_1",
  playerToken: "pt_1",
  username: "alice",
  role: "player",
  isHost: true,
  // settings is optional
};

const res: PartyRegisterResponse = {
  ok: true,
  roomId: "ABC123",
  settings: {
    matchDurationSec: 600,
    playerCap: 99,
    stackLimit: 10,
    startingQueued: 2,
    difficultyProfile: "moderate",
    attackIntensity: "low",
  },
  matchPhase: "lobby",
  counts: { players: 1, spectators: 0 },
};

void req;
void res;
```

**Step 2: Run typecheck to verify it fails**

Run: `pnpm turbo typecheck --filter=@leet99/contracts`

Expected: FAIL with missing exported types.

**Step 3: Implement minimal schemas/types**

In `packages/contracts/src/http.ts`, add (near other HTTP schemas):

```ts
export const PartyRegisterRequestSchema = z.object({
  playerId: z.string(),
  playerToken: z.string(),
  username: z.string().min(1).max(16),
  role: z.enum(["player", "spectator"]),
  isHost: z.boolean(),
  settings: RoomSettingsSchema.partial().optional(),
});
export type PartyRegisterRequest = z.infer<typeof PartyRegisterRequestSchema>;

export const PartyRegisterResponseSchema = z.object({
  ok: z.literal(true),
  roomId: z.string(),
  settings: RoomSettingsSchema,
  matchPhase: MatchPhaseSchema,
  counts: z.object({
    players: z.number().int().min(0),
    spectators: z.number().int().min(0),
  }),
});
export type PartyRegisterResponse = z.infer<typeof PartyRegisterResponseSchema>;
```

**Step 4: Run typecheck to verify it passes**

Run: `pnpm turbo typecheck --filter=@leet99/contracts`

Expected: PASS.

**Step 5: Remove temp file and commit**

- Delete: `packages/contracts/src/__tmp_register_types_check.ts`

Run:

- `pnpm turbo typecheck --filter=@leet99/contracts`

Commit:

```bash
git add packages/contracts/src/http.ts packages/contracts/src/index.ts
git commit -m "feat(contracts): add PartyKit register request/response types"
```

---

### Task 2: Make PartyKit room authoritative for create/join constraints

**Files:**

- Modify: `packages/realtime/src/room.ts`
- (Optional refactor) Create: `packages/realtime/src/register.ts`
- (Optional tests) Create: `packages/realtime/test/register.test.ts`

**Step 1: Write failing unit tests for registration logic**

Create: `packages/realtime/test/register.test.ts`

Use Node’s built-in runner (no deps):

```ts
import test from "node:test";
import assert from "node:assert/strict";

import {
  registerPlayer,
  type RegisterOutcome,
  createInitialState,
} from "../src/register";

test("join before room created -> ROOM_NOT_FOUND", () => {
  const state = createInitialState("AB12CD");
  const out = registerPlayer(state, {
    playerId: "p_2",
    playerToken: "pt_2",
    username: "bob",
    role: "player",
    isHost: false,
  });

  assert.equal(out.ok, false);
  assert.equal(out.error.code, "ROOM_NOT_FOUND");
});

test("create initializes settings and sets host", () => {
  const state = createInitialState("AB12CD");
  const out = registerPlayer(state, {
    playerId: "p_1",
    playerToken: "pt_1",
    username: "alice",
    role: "player",
    isHost: true,
    settings: { playerCap: 2 },
  });

  assert.equal(out.ok, true);
  assert.equal(out.snapshot.counts.players, 1);
  assert.equal(out.snapshot.matchPhase, "lobby");
  assert.equal(out.snapshot.settings.playerCap, 2);
});

test("username is case-insensitively unique", () => {
  const state = createInitialState("AB12CD");
  registerPlayer(state, {
    playerId: "p_1",
    playerToken: "pt_1",
    username: "Alice",
    role: "player",
    isHost: true,
  });

  const out = registerPlayer(state, {
    playerId: "p_2",
    playerToken: "pt_2",
    username: "alice",
    role: "spectator",
    isHost: false,
  });

  assert.equal(out.ok, false);
  assert.equal(out.error.code, "USERNAME_TAKEN");
});

test("player join after match started -> MATCH_ALREADY_STARTED", () => {
  const state = createInitialState("AB12CD");
  registerPlayer(state, {
    playerId: "p_1",
    playerToken: "pt_1",
    username: "alice",
    role: "player",
    isHost: true,
  });

  // simulate match started
  state.match.phase = "warmup";

  const out = registerPlayer(state, {
    playerId: "p_2",
    playerToken: "pt_2",
    username: "bob",
    role: "player",
    isHost: false,
  });

  assert.equal(out.ok, false);
  assert.equal(out.error.code, "MATCH_ALREADY_STARTED");
});

test("player cap enforced for role=player", () => {
  const state = createInitialState("AB12CD");
  registerPlayer(state, {
    playerId: "p_1",
    playerToken: "pt_1",
    username: "alice",
    role: "player",
    isHost: true,
    settings: { playerCap: 1 },
  });

  const out = registerPlayer(state, {
    playerId: "p_2",
    playerToken: "pt_2",
    username: "bob",
    role: "player",
    isHost: false,
  });

  assert.equal(out.ok, false);
  assert.equal(out.error.code, "ROOM_FULL");
});
```

**Step 2: Run tests to verify they fail**

Run: `node --test packages/realtime/test/register.test.ts`

Expected: FAIL because `../src/register` does not exist.

**Step 3: Implement minimal pure registration module**

Create: `packages/realtime/src/register.ts`

```ts
import {
  RoomSettingsSchema,
  type RoomSettings,
  type MatchPublic,
} from "@leet99/contracts";
import type {
  PartyRegisterRequest,
  PartyRegisterResponse,
} from "@leet99/contracts";

export type RegisterError = {
  code:
    | "ROOM_NOT_FOUND"
    | "ROOM_FULL"
    | "USERNAME_TAKEN"
    | "MATCH_ALREADY_STARTED"
    | "BAD_REQUEST";
  message: string;
};

export type RegisterOutcome =
  | { ok: true; snapshot: PartyRegisterResponse }
  | { ok: false; error: RegisterError };

export type RoomStateForRegister = {
  roomId: string;
  isCreated: boolean;
  settings: RoomSettings;
  match: MatchPublic;
  players: Array<{ username: string; role: "player" | "spectator" }>;
};

export function createInitialState(roomId: string): RoomStateForRegister {
  const settings = RoomSettingsSchema.parse({});
  return {
    roomId,
    isCreated: false,
    settings,
    match: { matchId: null, phase: "lobby", settings },
    players: [],
  };
}

export function registerPlayer(
  state: RoomStateForRegister,
  req: PartyRegisterRequest,
): RegisterOutcome {
  const trimmed = req.username.trim();
  if (trimmed.length < 1 || trimmed.length > 16) {
    return {
      ok: false,
      error: {
        code: "BAD_REQUEST",
        message: "Username must be 1-16 characters",
      },
    };
  }

  // join cannot create a room
  if (!state.isCreated && !req.isHost) {
    return {
      ok: false,
      error: { code: "ROOM_NOT_FOUND", message: "Room not found" },
    };
  }

  // create initializes room
  if (!state.isCreated && req.isHost) {
    state.isCreated = true;
    state.settings = RoomSettingsSchema.parse({ ...req.settings });
    state.match = { ...state.match, settings: state.settings };
  }

  // enforce lobby-only player joining
  if (req.role === "player" && state.match.phase !== "lobby") {
    return {
      ok: false,
      error: {
        code: "MATCH_ALREADY_STARTED",
        message: "Match already started",
      },
    };
  }

  // username unique across players + spectators (case-insensitive)
  const lower = trimmed.toLowerCase();
  if (state.players.some((p) => p.username.toLowerCase() === lower)) {
    return {
      ok: false,
      error: {
        code: "USERNAME_TAKEN",
        message: "That username is already in use in this room.",
      },
    };
  }

  // enforce player cap for role=player
  if (req.role === "player") {
    const playerCount = state.players.filter((p) => p.role === "player").length;
    if (playerCount >= state.settings.playerCap) {
      return {
        ok: false,
        error: { code: "ROOM_FULL", message: "Room is full" },
      };
    }
  }

  state.players.push({ username: trimmed, role: req.role });

  const counts = {
    players: state.players.filter((p) => p.role === "player").length,
    spectators: state.players.filter((p) => p.role === "spectator").length,
  };

  return {
    ok: true,
    snapshot: {
      ok: true,
      roomId: state.roomId,
      settings: state.settings,
      matchPhase: state.match.phase,
      counts,
    },
  };
}
```

**Step 4: Run tests to verify they pass**

Run: `node --test packages/realtime/test/register.test.ts`

Expected: PASS.

**Step 5: Wire this into `packages/realtime/src/room.ts` and commit**

Update `packages/realtime/src/room.ts`:

- Add `isCreated: boolean` to `RoomState` and persist it.
- Update `onRequest` `POST .../register` handler to:
  - parse body with `PartyRegisterRequestSchema`
  - call `registerPlayer` (but also store full player records including `playerId` and `playerToken`)
  - enforce/return canonical errors with proper HTTP status:
    - `ROOM_NOT_FOUND` → 404
    - `ROOM_FULL` → 409
    - `USERNAME_TAKEN` → 409
    - `MATCH_ALREADY_STARTED` → 409
    - `BAD_REQUEST` → 400
  - on success return `PartyRegisterResponse` JSON.
- Ensure the room’s in-memory `players` map is updated (this is what `JOIN_ROOM` uses).
- Persist to `room.storage.put("state", ...)` after successful register.

Commit:

```bash
git add packages/realtime/src/room.ts packages/realtime/src/register.ts packages/realtime/test/register.test.ts
git commit -m "feat(realtime): enforce room create/join constraints"
```

---

### Task 3: Add a small server-to-server PartyKit client helper

**Files:**

- Create: `apps/web/src/server/partykit.ts`
- Modify: `apps/web/app/api/rooms/route.ts`
- Modify: `apps/web/app/api/rooms/[roomId]/join/route.ts`

**Step 1: Write a failing compile-time usage**

In `apps/web/app/api/rooms/route.ts`, temporarily import a helper that doesn’t exist yet:

```ts
import { registerPartyPlayer, toWsUrl } from "@/src/server/partykit";
```

Run: `pnpm turbo typecheck --filter=@leet99/web`

Expected: FAIL, module not found.

**Step 2: Implement `apps/web/src/server/partykit.ts`**

Create a server-only helper:

```ts
import {
  PartyRegisterRequestSchema,
  type PartyRegisterRequest,
  PartyRegisterResponseSchema,
  type PartyRegisterResponse,
  type HttpErrorResponse,
} from "@leet99/contracts";

export function partyBaseUrl(): string {
  return process.env.PARTYKIT_HOST || "http://localhost:1999";
}

export function partyProject(): string {
  return process.env.PARTYKIT_PROJECT || "leet99";
}

export function toWsUrl(roomId: string): string {
  const base = partyBaseUrl().replace(/\/$/, "");
  const project = partyProject();
  // Convert http(s) -> ws(s)
  const wsBase = base.replace(/^http/, "ws");
  return `${wsBase}/parties/${project}/${roomId}`;
}

export async function registerPartyPlayer(
  roomId: string,
  input: PartyRegisterRequest,
): Promise<
  | { ok: true; data: PartyRegisterResponse }
  | { ok: false; error: HttpErrorResponse; status: number }
> {
  const parsed = PartyRegisterRequestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      error: {
        error: {
          code: "BAD_REQUEST",
          message: "Invalid register payload",
          details: parsed.error.flatten(),
        },
      },
    };
  }

  const url = `${partyBaseUrl().replace(/\/$/, "")}/parties/${partyProject()}/${roomId}/register`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed.data),
    cache: "no-store",
  });

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    // assume PartyKit returns HttpErrorResponse-like shape
    const err = (json ?? {
      error: { code: "INTERNAL_ERROR", message: "PartyKit error" },
    }) as HttpErrorResponse;
    return { ok: false, status: res.status, error: err };
  }

  const okParsed = PartyRegisterResponseSchema.safeParse(json);
  if (!okParsed.success) {
    return {
      ok: false,
      status: 502,
      error: {
        error: { code: "INTERNAL_ERROR", message: "Invalid PartyKit response" },
      },
    };
  }

  return { ok: true, data: okParsed.data };
}
```

**Step 3: Run typecheck to verify it passes**

Run: `pnpm turbo typecheck --filter=@leet99/web`

Expected: PASS.

**Step 4: Commit**

```bash
git add apps/web/src/server/partykit.ts
git commit -m "feat(web): add PartyKit server-side register client"
```

---

### Task 4: Implement `POST /api/rooms` via PartyKit register

**Files:**

- Modify: `apps/web/app/api/rooms/route.ts`

**Step 1: Add a failing manual verification script**

Run these _before_ implementation and confirm it currently returns mock and does not create PartyKit state:

- Start PartyKit: `pnpm --filter=@leet99/realtime dev`
- Start Next: `pnpm --filter=@leet99/web dev`

Then:

```bash
curl -s -X POST "http://localhost:3000/api/rooms" \
  -H "Content-Type: application/json" \
  -d '{"username":"alice"}'
```

Expected (current): 201 but without real PartyKit-backed constraints.

**Step 2: Implement create flow**

In `apps/web/app/api/rooms/route.ts`:

- Keep existing request validation.
- Generate `roomId`, `playerId`, `playerToken`.
- Call `registerPartyPlayer(roomId, { playerId, playerToken, username: trimmedUsername, role: "player", isHost: true, settings })`.
- If PartyKit returns 409 (room already created), retry with a new `roomId` up to (say) 5 attempts.
- Build `wsUrl` using `toWsUrl(roomId)`.
- Return `CreateRoomResponse` with settings from the PartyKit response (not local parse) to ensure single source of truth.

**Step 3: Verify manually**

Repeat the `curl` call above.

Expected:

- HTTP `201` with `roomId`, `playerToken`, and a `wsUrl` whose scheme is `ws://` in dev.
- PartyKit state exists:

```bash
curl -s "http://localhost:1999/parties/leet99/<roomId>/state"
```

Expected: JSON includes `playerCount: 1` and `phase: "lobby"`.

**Step 4: Commit**

```bash
git add apps/web/app/api/rooms/route.ts
git commit -m "feat(api): create room via PartyKit register"
```

---

### Task 5: Implement `POST /api/rooms/:roomId/join` via PartyKit register

**Files:**

- Modify: `apps/web/app/api/rooms/[roomId]/join/route.ts`

**Step 1: Manual failing checks (current behavior)**

After creating a room, try joining it twice with the same username:

```bash
curl -s -X POST "http://localhost:3000/api/rooms/<roomId>/join" \
  -H "Content-Type: application/json" \
  -d '{"username":"bob","role":"player"}'

curl -s -X POST "http://localhost:3000/api/rooms/<roomId>/join" \
  -H "Content-Type: application/json" \
  -d '{"username":"bob","role":"spectator"}'
```

Expected (target behavior): second call returns `409 USERNAME_TAKEN`.

**Step 2: Implement join flow**

In `apps/web/app/api/rooms/[roomId]/join/route.ts`:

- Keep existing request body validation.
- Keep username trimming and 1–16 char enforcement.
- Default `role` to `"player"` (already schema default).
- Generate `playerId`, `playerToken`.
- Call `registerPartyPlayer(roomId, { playerId, playerToken, username: trimmedUsername, role, isHost: false })`.
- On PartyKit error, pass through the status and `HttpErrorResponse` (ensure standard shape).
- On success, return `JoinRoomResponse` using PartyKit response settings.

**Step 3: Verify key scenarios manually**

1. Room does not exist:

```bash
curl -i -s -X POST "http://localhost:3000/api/rooms/NOPE00/join" \
  -H "Content-Type: application/json" \
  -d '{"username":"bob","role":"player"}'
```

Expected: `404` with `{ error: { code: "ROOM_NOT_FOUND", ... } }`.

2. Username taken (case-insensitive):

- Join as `bob`, then join as `Bob`.

Expected: `409` `USERNAME_TAKEN`.

3. Player cap:

- Create room with `settings.playerCap = 1`, then attempt a second player join.

Expected: `409` `ROOM_FULL`.

4. Match already started:

- Temporarily set PartyKit room state’s `match.phase` to `"warmup"` (via dev-only hack or console in PartyKit) and attempt `role="player"` join.

Expected: `409` `MATCH_ALREADY_STARTED`.

**Step 4: Commit**

```bash
git add apps/web/app/api/rooms/[roomId]/join/route.ts
git commit -m "feat(api): join room via PartyKit register"
```

---

### Task 6: Repo-wide verification

**Files:**

- No code changes required (unless issues found)

**Step 1: Typecheck**

Run: `pnpm turbo typecheck`

Expected: PASS.

**Step 2: Lint**

Run: `pnpm turbo lint`

Expected: PASS.

**Step 3: Format check**

Run: `pnpm format:check`

Expected: PASS.
