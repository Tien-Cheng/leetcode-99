---
title: LeetCode 99 Backend API Spec (MVP)
tags: [HackAndRoll2026, LeetCode99, api]
---

# LeetCode 99 — Backend API Spec (MVP)

## 0. Scope

This spec defines the implementable backend contracts for:

- Next.js HTTP endpoints (room creation, join, results/leaderboard)
- PartyKit Room WebSocket events (authoritative realtime game state)
- Lobby chat contracts (lobby-only, via PartyKit)
- Persistence shape for match results (Supabase)

MVP language:

- Python-only, function-only problems (clients do not send `language`; server uses a configured Python Judge0 language id).

Non-goals (MVP): accounts, anti-cheat, plagiarism detection.

## 1. Components

- **Client**: Next.js UI
- **HTTP API**: Next.js API routes
- **Realtime**: PartyKit Room (authoritative game engine)
- **Judge**: Judge0 CE via RapidAPI (authoritative `SUBMIT_CODE` execution)
- **DB**: Supabase Postgres (match results + leaderboard)

## 2. Conventions

### 2.1 Serialization

- Payloads are JSON.
- JSON keys are `camelCase`.

### 2.2 Timestamps

- Use ISO 8601 strings in UTC, e.g. `2026-01-16T12:34:56.789Z`.

### 2.3 Identifiers

- `roomId`: short, URL-safe string (e.g. `AB12CD`).
- `matchId`: string (server-generated).
- `playerId`: string (server-generated).
- `problemId`: string (from the problem bank).

### 2.4 Auth tokens (anonymous)

- `playerToken` is an opaque string issued by the HTTP API.
- Clients MUST store `playerToken` (e.g. localStorage) and present it when joining the PartyKit room.
- `playerToken` supports reconnecting to the same `playerId`.
- Clients MUST treat `playerToken` as a secret (do not log or share).

### 2.5 HTTP auth

When an HTTP endpoint requires auth, send:

- `Authorization: Bearer <playerToken>`

MVP note: all HTTP endpoints in this spec are public (no auth required); this header is reserved for future admin/host endpoints.

### 2.6 WebSocket message envelope

All PartyKit room messages use this JSON envelope:

```ts
type WSMessage<TType extends string, TPayload> = {
  type: TType;
  requestId?: string; // client-generated, for correlating responses
  payload: TPayload;
};
```

Servers SHOULD echo `requestId` on direct responses (`JUDGE_RESULT`, `ERROR`).

### 2.7 Judge integration (RapidAPI)

- Judge0 CE is consumed via RapidAPI; only server-side components (PartyKit room / Next.js API) call it.
- The browser MUST NOT call Judge0 directly (keeps `X-RapidAPI-Key` secret).
- Requests MUST include RapidAPI auth headers:
  - `X-RapidAPI-Key: <secret>`
  - `X-RapidAPI-Host: <assigned host>`
- Operational notes (MVP):
  - Treat `429` / quota errors / `5xx` as `JUDGE_UNAVAILABLE` and include `retryAfterMs` when available.
  - Use aggressive per-player rate limits (section 6) plus a short-lived cache (e.g. 30s keyed by `(problemId, codeHash)`) to reduce spend.

## 3. Roles, Permissions, and Host Transfer

### 3.1 Roles

- `player`: a human participant
- `bot`: server-simulated player
- `spectator`: read-only viewer

### 3.2 Host

- The room has exactly one `hostPlayerId` at a time.
- Only a `player` (human) may be host.
- If the host disconnects and at least one connected human player remains, the server auto-transfers host.
- Host transfer selection: choose the connected human player with the earliest join order (tie-break by `playerId`).
- If the original host reconnects later, they do NOT automatically regain host.
- If no connected human players remain, `hostPlayerId` becomes `null` and host-only actions are unavailable.

### 3.3 Spectating rules

- For this spec, “alive” means `status != 'eliminated'`.
- Alive players MUST NOT be allowed to spectate other players.
- `spectator` role can spectate at any time.
- Eliminated players can spectate after elimination.
- Spectators see the same information the player sees (no hidden test details).

## 4. Shared Models (MVP)

### 4.1 Room settings

```ts
type DifficultyProfile = "beginner" | "moderate" | "competitive";
type AttackIntensity = "low" | "high";
type MatchMode = "battleRoyale" | "sprint" | "duel" | "coOpDuo" | "endless";
type TempoProfile = "steady" | "surge" | "chaos";

type QuestionMix = {
  code: number;
  bugfix?: number;
  fillBlank?: number;
  trace?: number;
  mcq?: number;
};

type RoomSettings = {
  matchDurationSec: number; // default 600
  playerCap: number; // human players only, default 8
  stackLimit: number; // default 10
  startingQueued: number; // default 2
  difficultyProfile: DifficultyProfile;
  attackIntensity: AttackIntensity;
  matchMode: MatchMode; // default "battleRoyale"
  tempoProfile?: TempoProfile; // default "steady"
  questionMix?: QuestionMix; // normalized weights
};
```

Semantics (MVP):

- `difficultyProfile` controls difficulty sampling weights.
- `attackIntensity` scales timed debuff durations (see section 8.6).
- `matchMode` toggles attacks/stack rules (solo/co-op disable attacks).
- `tempoProfile` picks cadence presets (steady/surge/chaos).
- `questionMix` sets weights for question kinds; omitted means code-heavy.

### 4.2 Player (public)

```ts
type PlayerRole = "player" | "bot" | "spectator";

type PlayerStatus = "lobby" | "coding" | "error" | "underAttack" | "eliminated";

type TargetingMode = "random" | "attackers" | "topScore" | "nearDeath";

type DebuffType = "ddos" | "flashbang" | "vimLock" | "memoryLeak";
type AttackType = DebuffType | "garbageDrop";

type ActiveDebuff = {
  type: DebuffType;
  endsAt: string; // ISO timestamp
};

type BuffType = "rateLimiter";

type ActiveBuff = {
  type: BuffType;
  endsAt: string; // ISO timestamp
};

type PlayerPublic = {
  playerId: string;
  username: string;
  role: PlayerRole;
  status: PlayerStatus;
  isHost: boolean;
  score: number;
  streak: number;
  targetingMode: TargetingMode;
  stackSize: number; // queued only; current excluded
  activeDebuff?: ActiveDebuff | null;
  activeBuff?: ActiveBuff | null;
};
```

Status semantics (MVP):

- `eliminated`: eliminated from match
- `underAttack`: `activeDebuff != null`
- `error`: last `RUN_CODE`/`SUBMIT_CODE` had failing public tests or runtime error
- `coding`: default during match
- `lobby`: match not started

### 4.3 Problems

Clients MUST NEVER receive `hiddenTests`.

```ts
type Difficulty = "easy" | "medium" | "hard";
type QuestionKind = "code" | "bugfix" | "fillBlank" | "trace" | "mcq";

type TestCase = {
  input: unknown; // JSON-serializable
  output: unknown; // JSON-serializable
};

type McqOption = {
  id: string; // stable option id
  text: string;
};

type AnswerSpec =
  | {
      kind: "mcq";
      options: McqOption[];
      multi?: boolean; // default false
    }
  | {
      kind: "trace";
      format: "string" | "json";
    };

type ProblemClientView = {
  problemId: string;
  kind: QuestionKind;
  title: string;
  prompt: string;
  functionName?: string; // code/bugfix/fillBlank
  signature?: string; // code/bugfix/fillBlank
  starterCode?: string; // code/bugfix/fillBlank
  publicTests?: TestCase[]; // code/bugfix/fillBlank
  difficulty: Difficulty;
  timeLimitMs: number;
  expectedSolveSec?: number;
  answerSpec?: AnswerSpec; // mcq/trace
  hintCount?: number; // number of purchasable hint lines
  isGarbage?: boolean;
};
```

Notes:

- Hint strings are not sent up-front; they appear in `self.revealedHints` / `spectating.revealedHints` after buying `hint`.
- Non-code questions omit `starterCode` and `publicTests`; they include `answerSpec` for validation.

### 4.4 Judge results

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
  kind: "run" | "submit" | "answer";
  problemId: string;
  passed: boolean;
  publicTests?: PublicTestResult[];
  runtimeMs?: number;
  // Hidden test failures are opaque:
  hiddenTestsPassed?: boolean;
  hiddenFailureMessage?: string; // e.g. "Failed hidden tests"
  answerCorrect?: boolean; // for mcq/trace
  answerFeedback?: string; // short explanation or hint
};
```

### 4.5 Event log

```ts
type EventLogLevel = "info" | "warning" | "error";

type EventLogEntry = {
  id: string;
  at: string; // ISO timestamp
  level: EventLogLevel;
  message: string;
};
```

### 4.5.1 Lobby chat

Lobby chat is a separate channel from `eventLog`.

```ts
type ChatMessageKind = "user" | "system";

type ChatMessage = {
  id: string;
  at: string; // ISO timestamp
  kind: ChatMessageKind;
  text: string;
  fromPlayerId?: string;
  fromUsername?: string;
};
```

Notes:

- Lobby chat is **lobby-only** for MVP. Clients MAY still render it during a match, but the server only accepts new messages while `match.phase="lobby"`.
- The server stores the most recent N messages (recommended N=100) and includes them in `RoomSnapshot.chat` for resync.
- The server SHOULD append `kind="system"` messages for join/leave, host transfer, bots added, and match start.

### 4.6 Problem summary (for stacks)

```ts
type ProblemSummary = {
  problemId: string;
  title: string;
  kind: QuestionKind;
  difficulty: Difficulty;
  isGarbage?: boolean;
};
```

### 4.7 Match state (public)

```ts
type MatchPhase =
  | "lobby"
  | "warmup"
  | "flow"
  | "surge"
  | "finale"
  | "boss"
  | "ended";

type MatchEndReason = "lastAlive" | "timeExpired";

type MatchPublic = {
  matchId: string | null;
  phase: MatchPhase;
  startAt?: string;
  endAt?: string;
  endReason?: MatchEndReason;
  settings: RoomSettings;
};
```

Semantics:

- In lobby, `matchId` is `null` and `phase` is `lobby`.
- On `START_MATCH`, server sets `matchId`, `startAt`, `endAt`, and `phase` to `warmup`.
- Server may transition `phase` through `flow`, `surge`, and `finale` (and optionally `boss`) during the match.
- When the match ends, `phase` becomes `ended` and `endReason` is set.

### 4.8 Private player state (self)

This shape is only sent to the requesting client for their own player state.

```ts
type PlayerPrivateState = {
  currentProblem: ProblemClientView | null;
  queued: ProblemSummary[]; // top at index 0
  code: string;
  codeVersion: number;
  revealedHints: string[]; // for currentProblem only
};
```

### 4.9 Spectate view (read-only)

This shape is only sent to clients who are allowed to spectate a target player.

```ts
type SpectateView = {
  playerId: string;
  username: string;
  status: PlayerStatus;
  score: number;
  streak: number;
  targetingMode: TargetingMode;
  stackSize: number;
  activeDebuff?: ActiveDebuff | null;
  activeBuff?: ActiveBuff | null;
  currentProblem: ProblemClientView | null;
  queued: ProblemSummary[];
  code: string;
  codeVersion: number;
  revealedHints: string[];
};
```

### 4.10 Room snapshot (server → client)

```ts
type RoomSnapshot = {
  roomId: string;
  serverTime: string;
  me: {
    playerId: string;
    username: string;
    role: PlayerRole;
    isHost: boolean;
    status: PlayerStatus;
  };
  players: PlayerPublic[];
  match: MatchPublic;
  shopCatalog?: ShopCatalogItem[];
  self?: PlayerPrivateState;
  spectating?: SpectateView | null;
  chat: ChatMessage[];
  eventLog: EventLogEntry[];
};
```

Notes:

- For `role="player"`, `self` SHOULD be present during a match and MAY be omitted in lobby.
- For `role="spectator"`, `self` MUST be omitted.
- `shopCatalog` SHOULD be present for all clients so UIs can render costs.

### 4.11 Shop

```ts
type ShopItem =
  | "clearDebuff"
  | "memoryDefrag"
  | "skipProblem"
  | "rateLimiter"
  | "hint";

type ShopCatalogItem = {
  item: ShopItem;
  cost: number;
  cooldownSec?: number;
};
```

Recommended MVP catalog (server-defined, sent via `shopCatalog`):

- `clearDebuff`: cost 10
- `memoryDefrag`: cost 10
- `skipProblem`: cost 15
- `rateLimiter`: cost 10, `cooldownSec: 60`
- `hint`: cost 5

## 5. Errors

### 5.1 Error shape

All HTTP error responses:

```json
{
  "error": {
    "code": "USERNAME_TAKEN",
    "message": "That username is already in use in this room.",
    "details": {}
  }
}
```

All WebSocket errors (server → client):

```json
{
  "type": "ERROR",
  "requestId": "optional",
  "payload": {
    "code": "RATE_LIMITED",
    "message": "Too many requests.",
    "retryAfterMs": 1000
  }
}
```

### 5.2 Canonical error codes (MVP)

- `BAD_REQUEST`
- `UNAUTHORIZED`
- `FORBIDDEN`
- `ROOM_NOT_FOUND`
- `ROOM_FULL`
- `USERNAME_TAKEN`
- `MATCH_ALREADY_STARTED`
- `MATCH_NOT_STARTED`
- `MATCH_NOT_FOUND`
- `PLAYER_NOT_FOUND`
- `PLAYER_ELIMINATED`
- `PROBLEM_NOT_FOUND`
- `INSUFFICIENT_SCORE`
- `ITEM_ON_COOLDOWN`
- `RATE_LIMITED`
- `PAYLOAD_TOO_LARGE`
- `JUDGE_UNAVAILABLE`
- `INTERNAL_ERROR`

## 6. Rate Limits (MVP)

Rate limits are enforced per `playerId`.

- `RUN_CODE`: max 1 request per 2 seconds
- `SUBMIT_CODE`: max 1 request per 3 seconds
- `SUBMIT_ANSWER`: max 1 request per 3 seconds
- `CODE_UPDATE` (editor streaming): max 10 updates per second; `code` payload <= 50_000 bytes
- `SPECTATE_PLAYER`: max 1 request per second
- `SEND_CHAT`: max 2 messages per second; `text` <= 200 chars

## 7. HTTP API (Next.js)

All HTTP endpoints:

- Use JSON request/response bodies.
- Require `Content-Type: application/json` for requests with a body.

### 7.1 Create room (and join as host)

`POST /api/rooms`

Creates a room in `lobby` phase and joins the creator as the initial host.

Request body:

```json
{
  "username": "alice",
  "settings": {
    "matchDurationSec": 600,
    "playerCap": 8,
    "stackLimit": 10,
    "startingQueued": 2,
    "difficultyProfile": "moderate",
    "attackIntensity": "low",
    "matchMode": "battleRoyale",
    "tempoProfile": "steady"
  }
}
```

Notes:

- `settings` is optional; omitted fields use server defaults.
- `username` rules (MVP):
  - trim whitespace
  - 1–16 chars
  - case-insensitive unique per room (players + spectators)

Response `201`:

```json
{
  "roomId": "AB12CD",
  "wsUrl": "wss://<partykit-host>/parties/leetcode99/AB12CD",
  "playerId": "p_123",
  "playerToken": "pt_...",
  "role": "player",
  "isHost": true,
  "settings": {
    "matchDurationSec": 600,
    "playerCap": 8,
    "stackLimit": 10,
    "startingQueued": 2,
    "difficultyProfile": "moderate",
    "attackIntensity": "low",
    "matchMode": "battleRoyale",
    "tempoProfile": "steady"
  }
}
```

Errors:

- `BAD_REQUEST`

### 7.2 Join room

`POST /api/rooms/:roomId/join`

Request body:

```json
{
  "username": "bob",
  "role": "player"
}
```

Rules:

- `username` rules (MVP):
  - trim whitespace
  - 1–16 chars
  - case-insensitive unique per room (players + spectators)
- If `role="player"`, joining is only allowed while the room is in lobby (match not started).
- If a match is already running, callers MUST join as `role="spectator"`.

Response `200`:

```json
{
  "roomId": "AB12CD",
  "wsUrl": "wss://<partykit-host>/parties/leetcode99/AB12CD",
  "playerId": "p_456",
  "playerToken": "pt_...",
  "role": "player",
  "settings": {
    "matchDurationSec": 600,
    "playerCap": 8,
    "stackLimit": 10,
    "startingQueued": 2,
    "difficultyProfile": "moderate",
    "attackIntensity": "low",
    "matchMode": "battleRoyale",
    "tempoProfile": "steady"
  }
}
```

Errors:

- `ROOM_NOT_FOUND`
- `ROOM_FULL` (only for `role="player"`)
- `USERNAME_TAKEN`
- `MATCH_ALREADY_STARTED` (only for `role="player"`)

### 7.3 Get room summary (optional)

`GET /api/rooms/:roomId`

Response `200`:

```json
{
  "roomId": "AB12CD",
  "phase": "lobby",
  "settings": {
    "matchDurationSec": 600,
    "playerCap": 8,
    "stackLimit": 10,
    "startingQueued": 2,
    "difficultyProfile": "moderate",
    "attackIntensity": "low",
    "matchMode": "battleRoyale",
    "tempoProfile": "steady"
  },
  "counts": {
    "players": 2,
    "spectators": 1
  }
}
```

Errors:

- `ROOM_NOT_FOUND`

### 7.4 Get match results

`GET /api/matches/:matchId`

Response `200`:

```json
{
  "match": {
    "matchId": "m_123",
    "roomId": "AB12CD",
    "startAt": "2026-01-16T12:00:00.000Z",
    "endAt": "2026-01-16T12:10:00.000Z",
    "endReason": "timeExpired",
    "settings": {
      "matchDurationSec": 600,
      "playerCap": 8,
      "stackLimit": 10,
      "startingQueued": 2,
      "difficultyProfile": "moderate",
      "attackIntensity": "low",
      "matchMode": "battleRoyale",
      "tempoProfile": "steady"
    }
  },
  "standings": [
    {
      "rank": 1,
      "playerId": "p_123",
      "username": "alice",
      "role": "player",
      "score": 120
    },
    {
      "rank": 2,
      "playerId": "p_bot1",
      "username": "Bot 1",
      "role": "bot",
      "score": 80
    }
  ]
}
```

Errors:

- `MATCH_NOT_FOUND`

### 7.5 Room match history (optional)

`GET /api/rooms/:roomId/matches?limit=20`

Response `200`:

```json
{
  "roomId": "AB12CD",
  "matches": [
    {
      "matchId": "m_123",
      "startAt": "2026-01-16T12:00:00.000Z",
      "endAt": "2026-01-16T12:10:00.000Z",
      "endReason": "timeExpired"
    }
  ]
}
```

Errors:

- `ROOM_NOT_FOUND`

### 7.6 Leaderboard (optional)

`GET /api/leaderboard?window=all&limit=50`

Semantics (MVP):

- Returns the top `match_players` rows sorted by `score desc`, tie-break by `match.endAt desc`.
- Since there are no accounts, `username` is not globally unique (duplicates possible).
- `window` is reserved for future filtering; MVP supports `window=all`.

Response `200`:

```json
{
  "window": "all",
  "entries": [
    {
      "rank": 1,
      "username": "alice",
      "score": 120,
      "matchId": "m_123",
      "at": "2026-01-16T12:10:00.000Z"
    }
  ]
}
```

## 8. Realtime API (PartyKit WebSocket)

### 8.1 Connect and authenticate

1. First-time join: client calls HTTP `create room` or `join room` to get `wsUrl` + `playerToken`.
2. Reconnect: if client already has `wsUrl` + `playerToken` stored, it MAY skip HTTP and go straight to WebSocket.
3. Client opens a WebSocket to `wsUrl`.
4. Client sends `JOIN_ROOM`.
5. Server responds with `ROOM_SNAPSHOT`.
6. Server may send `ROOM_SNAPSHOT` again at any time for resync (clients should treat it as authoritative).

Client → Server `JOIN_ROOM`:

```json
{
  "type": "JOIN_ROOM",
  "requestId": "req_1",
  "payload": {
    "playerToken": "pt_..."
  }
}
```

Auth failure:

- If `playerToken` is invalid or does not belong to this `roomId`, server sends `ERROR` with `code="UNAUTHORIZED"` and closes the socket.

Server → Client `ROOM_SNAPSHOT`:

```json
{
  "type": "ROOM_SNAPSHOT",
  "requestId": "req_1",
  "payload": {
    "roomId": "AB12CD",
    "serverTime": "2026-01-16T12:00:00.000Z",
    "me": {
      "playerId": "p_123",
      "username": "alice",
      "role": "player",
      "isHost": true,
      "status": "lobby"
    },
    "players": [],
    "match": {
      "matchId": null,
      "phase": "lobby",
      "settings": {
        "matchDurationSec": 600,
        "playerCap": 8,
        "stackLimit": 10,
        "startingQueued": 2,
        "difficultyProfile": "moderate",
        "attackIntensity": "low",
        "matchMode": "battleRoyale",
        "tempoProfile": "steady"
      }
    },
    "eventLog": []
  }
}
```

### 8.2 Client → Server events

#### `SET_TARGET_MODE`

Sets the player’s targeting mode (used by section 8.4).

```json
{
  "type": "SET_TARGET_MODE",
  "requestId": "req_2",
  "payload": {
    "mode": "nearDeath"
  }
}
```

#### `UPDATE_SETTINGS` (host-only, lobby-only)

Rules:

- Only the host may update settings.
- Only allowed while `match.phase="lobby"`.
- `patch` is a partial `RoomSettings`; omitted fields are unchanged.
- On success, server broadcasts `SETTINGS_UPDATE`.

```json
{
  "type": "UPDATE_SETTINGS",
  "requestId": "req_3",
  "payload": {
    "patch": {
      "matchDurationSec": 600,
      "difficultyProfile": "moderate"
    }
  }
}
```

#### `START_MATCH` (host-only, lobby-only)

Rules:

- Only the host may start the match.
- Only allowed while `match.phase="lobby"`.
- On success:
  - Server assigns `matchId`, `startAt`, `endAt`, and sets `phase="warmup"`.
  - Server broadcasts `MATCH_STARTED`.
  - Server sends each connected player an updated `ROOM_SNAPSHOT` containing their initial `self` (current problem + queued stack + starter code).

```json
{
  "type": "START_MATCH",
  "requestId": "req_4",
  "payload": {}
}
```

#### `RETURN_TO_LOBBY` (host-only, ended-only)

Resets the room back to lobby so the host can start a new match.

Rules (MVP):

- Only the host may reset the room.
- Only allowed while `match.phase="ended"`.
- On success, the server:
  - Clears match-specific state (scores, streaks, stacks, current problems, code, buffs/debuffs, matchId).
  - Sets `match.phase="lobby"` and `match.matchId=null`.
  - Broadcasts a fresh `ROOM_SNAPSHOT` to all connected clients.

```json
{
  "type": "RETURN_TO_LOBBY",
  "requestId": "req_4b",
  "payload": {}
}
```

#### `ADD_BOTS` (host-only, lobby-only)

Rules:

- Only the host may add bots.
- Only allowed while `match.phase="lobby"`.
- Bots do not count towards `playerCap`.

```json
{
  "type": "ADD_BOTS",
  "requestId": "req_5",
  "payload": {
    "count": 3
  }
}
```

#### `SEND_CHAT` (lobby chat)

Appends a lobby chat message.

Rules (MVP):

- Only accepted while `match.phase="lobby"`.
- Allowed for `role="player"` and `role="spectator"`.
- `text` is trimmed; 1–200 chars; reject if empty.
- Server broadcasts `CHAT_APPEND` on success.

```json
{
  "type": "SEND_CHAT",
  "requestId": "req_chat_1",
  "payload": {
    "text": "gg lets go"
  }
}
```

#### `RUN_CODE` (optional server fallback)

Rules (MVP):

- Player MUST NOT be eliminated.
- If `activeDebuff.type="ddos"`, server rejects with `ERROR` `FORBIDDEN` and includes `retryAfterMs` until `endsAt`.
- `problemId` MUST equal the player’s current problem id.
- Problem kind MUST be `code`, `bugfix`, or `fillBlank` (non-code uses `SUBMIT_ANSWER`).
- Server runs `publicTests` only.
- `RUN_CODE` does not change score/streak, does not send attacks, and does not advance the current problem.
- Server responds with `JUDGE_RESULT` with `kind="run"`.

```json
{
  "type": "RUN_CODE",
  "requestId": "req_6",
  "payload": {
    "problemId": "two-sum",
    "code": "def two_sum(nums, target):\n    ..."
  }
}
```

#### `SUBMIT_CODE`

Rules (MVP):

Validation:

- Player MUST NOT be eliminated.
- `problemId` MUST equal the player’s current problem id.
- Problem kind MUST be `code`, `bugfix`, or `fillBlank` (non-code uses `SUBMIT_ANSWER`).

Judging:

- Server runs `publicTests + hiddenTests` (authoritative).
- Hidden failures are opaque (do not reveal hidden inputs/outputs).

Scoring & streak:

- If submission fails: `streak` resets to 0; score unchanged.
- If submission passes:
  - If `isGarbage: true`: +0 points; does not increment streak; sends no attack.
  - Else points by difficulty: `easy` +5, `medium` +10, `hard` +20; increments streak by 1.

Problem advance (on pass only):

- Replace current problem by popping the top of `queued` (index 0).
- If `queued` is empty, server draws a fresh problem.
- Reset editor code to the new problem’s `starterCode`, set `codeVersion` to 1, and reset `revealedHints` to `[]`.

Attacks (on passing non-garbage only):

- Target is computed at submit time from `targetingMode` (see section 8.4).
- If `streak % 3 == 0`: send `memoryLeak` (replaces difficulty attack).
- Else if difficulty `easy`: `garbageDrop`.
- Else if difficulty `medium`: random `flashbang` or `vimLock`.
- Else if difficulty `hard`: `ddos`.

Events:

- Server sends `JUDGE_RESULT` to the submitting player and any authorized spectators currently spectating them.
- Server broadcasts `PLAYER_UPDATE` and `STACK_UPDATE` as applicable.
- If an attack is sent, server sends `ATTACK_RECEIVED` to the target (and their spectators) and updates target private state as needed (e.g. `garbageDrop` inserts into `queued`).
- Server MUST send an updated `ROOM_SNAPSHOT` to the submitting player after a pass (private state changed).
- If the player is being spectated, server MUST update authorized spectators (either via `SPECTATE_STATE` or by sending a new `ROOM_SNAPSHOT` including `spectating`).

```json
{
  "type": "SUBMIT_CODE",
  "requestId": "req_7",
  "payload": {
    "problemId": "two-sum",
    "code": "def two_sum(nums, target):\n    ..."
  }
}
```

#### `SUBMIT_ANSWER`

Rules (MVP):

Validation:

- Player MUST NOT be eliminated.
- `problemId` MUST equal the player’s current problem id.
- Problem kind MUST be `mcq` or `trace`.

Evaluation:

- Server validates against `answerSpec` (no Judge0 call).
- For MCQ, `answer` is an array of option ids (single-select uses a 1-item array).
- For trace, `answer` is a JSON-serializable value.

Scoring & streak:

- If answer fails: `streak` resets to 0; score unchanged.
- If answer passes:
  - If `isGarbage: true`: +0 points; does not increment streak; sends no attack.
  - Else points by difficulty (same as code by default; tune per mode).

Problem advance + attacks:

- Same as `SUBMIT_CODE` on pass (advance, attacks, streak handling).

Events:

- Server sends `JUDGE_RESULT` with `kind="answer"`.
- Server updates `PLAYER_UPDATE`, `STACK_UPDATE`, and target events as applicable.

```json
{
  "type": "SUBMIT_ANSWER",
  "requestId": "req_7a",
  "payload": {
    "problemId": "trace-1",
    "answer": ["b"]
  }
}
```

#### `SPEND_POINTS`

Rules:

- Only `role="player"` may spend points.
- Player MUST NOT be eliminated.
- Server validates `score >= cost` (from `shopCatalog`) and cooldown.
- Cost is deducted immediately on success (score MUST NOT go negative).
- If purchase succeeds:
  - Server broadcasts `PLAYER_UPDATE` (score changed).
  - Server sends an updated `ROOM_SNAPSHOT` to the buyer (private state may change).
  - If the buyer is being spectated, server updates authorized spectators (via `SPECTATE_STATE` or `ROOM_SNAPSHOT`).
- If purchase fails, server responds with `ERROR`:
  - `INSUFFICIENT_SCORE`
  - `ITEM_ON_COOLDOWN`
  - `BAD_REQUEST` (unknown item or invalid in current state)

Item semantics (MVP):

- `clearDebuff`
  - Removes `activeDebuff` immediately.
  - If no debuff is active, return `BAD_REQUEST` and do not charge.
- `memoryDefrag`
  - Removes all queued problems with `isGarbage=true`.
- `skipProblem`
  - Discards the current problem and advances exactly like a passing submission (but awards 0 points and sends no attack).
  - Resets `streak` to 0.
- `rateLimiter`
  - Applies `activeBuff={type:"rateLimiter"}` for 30s.
  - While active: base incoming problem interval ×2.
  - Cooldown recommended: 60s.
- `hint`
  - Reveals the next hint line for the current problem (appended to `self.revealedHints`).
  - If no more hints remain, return `BAD_REQUEST` and do not charge.

```json
{
  "type": "SPEND_POINTS",
  "requestId": "req_8",
  "payload": {
    "item": "skipProblem"
  }
}
```

#### `SPECTATE_PLAYER`

Permissions:

- Allowed for `role="spectator"`.
- Allowed for `status="eliminated"`.
- Forbidden for alive players.

```json
{
  "type": "SPECTATE_PLAYER",
  "requestId": "req_9",
  "payload": {
    "playerId": "p_123"
  }
}
```

#### `STOP_SPECTATE` (optional)

Stops spectating and clears `spectating`.

- Server responds with `SPECTATE_STATE` where `spectating` is `null`.

```json
{
  "type": "STOP_SPECTATE",
  "requestId": "req_10",
  "payload": {}
}
```

#### `CODE_UPDATE` (editor streaming)

Players send their current editor contents (throttled).

Rules:

- Only `role="player"` may send `CODE_UPDATE`.
- `codeVersion` MUST be monotonically increasing per player per match (start at 1).
- Server stores the highest `codeVersion` per player and ignores updates with `codeVersion <= lastSeen`.
- `code` payload is capped at 50_000 bytes (UTF-8). If exceeded, server responds with `ERROR` `PAYLOAD_TOO_LARGE`.

```json
{
  "type": "CODE_UPDATE",
  "payload": {
    "problemId": "two-sum",
    "code": "def two_sum(nums, target):\n    ...",
    "codeVersion": 12
  }
}
```

### 8.3 Server → Client events

Delivery rules:

- Public state deltas are streamed via `PLAYER_UPDATE`, `STACK_UPDATE`, and `CHAT_APPEND`.
- Private state changes for a specific player are delivered via a direct `ROOM_SNAPSHOT` to that player.
- When the `players` roster changes (join/leave) or the host changes, the server SHOULD resync all connected clients by sending each client a fresh `ROOM_SNAPSHOT` (including `RoomSnapshot.chat`).

#### `SETTINGS_UPDATE`

Broadcast when room settings change (lobby only).

```json
{
  "type": "SETTINGS_UPDATE",
  "payload": {
    "settings": {
      "matchDurationSec": 600,
      "playerCap": 8,
      "stackLimit": 10,
      "startingQueued": 2,
      "difficultyProfile": "moderate",
      "attackIntensity": "low",
      "matchMode": "battleRoyale",
      "tempoProfile": "steady"
    }
  }
}
```

#### `MATCH_STARTED`

Broadcast when the match transitions from `lobby` to `warmup`.

- Server MUST set `match.matchId`, `match.startAt`, `match.endAt`.
- Server MUST send each connected player an updated `ROOM_SNAPSHOT` including their initial `self`.

```json
{
  "type": "MATCH_STARTED",
  "payload": {
    "match": {
      "matchId": "m_123",
      "phase": "warmup",
      "startAt": "2026-01-16T12:00:00.000Z",
      "endAt": "2026-01-16T12:10:00.000Z",
      "settings": {
        "matchDurationSec": 600,
        "playerCap": 8,
        "stackLimit": 10,
        "startingQueued": 2,
        "difficultyProfile": "moderate",
        "attackIntensity": "low",
        "matchMode": "battleRoyale",
        "tempoProfile": "steady"
      }
    }
  }
}
```

#### `MATCH_PHASE_UPDATE` (optional)

Broadcast when `match.phase` changes (e.g. `warmup` → `main`).

```json
{
  "type": "MATCH_PHASE_UPDATE",
  "payload": {
    "matchId": "m_123",
    "phase": "flow"
  }
}
```

#### `PLAYER_UPDATE`

Broadcast when a player’s public state changes.

```json
{
  "type": "PLAYER_UPDATE",
  "payload": {
    "player": {
      "playerId": "p_123",
      "username": "alice",
      "role": "player",
      "status": "coding",
      "isHost": true,
      "score": 10,
      "streak": 1,
      "targetingMode": "random",
      "stackSize": 2,
      "activeDebuff": null,
      "activeBuff": null
    }
  }
}
```

#### `JUDGE_RESULT`

Sent to:

- The submitting player
- Any authorized spectators currently spectating that player

```json
{
  "type": "JUDGE_RESULT",
  "requestId": "req_7",
  "payload": {
    "kind": "submit",
    "problemId": "two-sum",
    "passed": true,
    "publicTests": [{ "index": 0, "passed": true }],
    "hiddenTestsPassed": true,
    "runtimeMs": 42
  }
}
```

#### `STACK_UPDATE`

Broadcast when a player’s stack size changes.

```json
{
  "type": "STACK_UPDATE",
  "payload": {
    "playerId": "p_123",
    "stackSize": 3
  }
}
```

#### `CHAT_APPEND` (lobby chat)

Broadcast when a lobby chat message is appended.

```json
{
  "type": "CHAT_APPEND",
  "payload": {
    "message": {
      "id": "c_1",
      "at": "2026-01-16T12:00:00.000Z",
      "kind": "user",
      "text": "gg lets go",
      "fromPlayerId": "p_123",
      "fromUsername": "alice"
    }
  }
}
```

#### `ATTACK_RECEIVED`

Sent to:

- The targeted player
- Any authorized spectators currently spectating that player

Notes:

- For timed debuffs (`ddos`, `flashbang`, `vimLock`, `memoryLeak`), `endsAt` is present.
- For `garbageDrop`, `endsAt` is omitted and `addedProblem` is present.

Timed debuff example:

```json
{
  "type": "ATTACK_RECEIVED",
  "payload": {
    "type": "vimLock",
    "fromPlayerId": "p_123",
    "endsAt": "2026-01-16T12:00:15.000Z"
  }
}
```

Garbage Drop example:

```json
{
  "type": "ATTACK_RECEIVED",
  "payload": {
    "type": "garbageDrop",
    "fromPlayerId": "p_123",
    "addedProblem": {
      "problemId": "garbage-1",
      "title": "Count vowels",
      "difficulty": "easy",
      "isGarbage": true
    }
  }
}
```

#### `EVENT_LOG_APPEND`

```json
{
  "type": "EVENT_LOG_APPEND",
  "payload": {
    "entry": {
      "id": "e_1",
      "at": "2026-01-16T12:00:00.000Z",
      "level": "info",
      "message": "alice solved an Easy (+5) and sent Garbage Drop"
    }
  }
}
```

#### `SPECTATE_STATE`

Sent after `SPECTATE_PLAYER` (and `STOP_SPECTATE`).

- `spectating` is `null` when not currently spectating anyone.

```json
{
  "type": "SPECTATE_STATE",
  "requestId": "req_9",
  "payload": {
    "spectating": {
      "playerId": "p_123",
      "username": "alice",
      "status": "coding",
      "score": 10,
      "streak": 1,
      "targetingMode": "random",
      "stackSize": 2,
      "activeDebuff": null,
      "activeBuff": null,
      "currentProblem": null,
      "queued": [],
      "code": "def two_sum(nums, target):\n    ...",
      "codeVersion": 12,
      "revealedHints": []
    }
  }
}
```

#### `CODE_UPDATE` (relayed)

Sent to authorized spectators who are currently spectating the author.

```json
{
  "type": "CODE_UPDATE",
  "payload": {
    "playerId": "p_123",
    "problemId": "two-sum",
    "code": "def two_sum(nums, target):\n    ...",
    "codeVersion": 13
  }
}
```

#### `MATCH_END`

Rules:

- Match ends when:
  - `now >= match.endAt` (`endReason="timeExpired"`), or
  - only one alive non-spectator remains (`endReason="lastAlive"`).
- `winnerPlayerId`:
  - `lastAlive`: the last alive player
  - `timeExpired`: highest `score` among alive players; tie-break by lowest `stackSize`, then stable by `playerId`
- `standings` ordering:
  - Primary: alive players first
  - Secondary: `score desc`
  - Tertiary: `stackSize asc`

```json
{
  "type": "MATCH_END",
  "payload": {
    "matchId": "m_123",
    "endReason": "timeExpired",
    "winnerPlayerId": "p_123",
    "standings": [
      {
        "rank": 1,
        "playerId": "p_123",
        "username": "alice",
        "role": "player",
        "score": 120
      }
    ]
  }
}
```

### 8.4 Targeting Algorithm (MVP)

When a player sends an attack (via passing a non-garbage `SUBMIT_CODE`), the server chooses a target based on the attacker’s `targetingMode`.

Definitions:

- A player is “alive” iff `status != 'eliminated'`.
- Attack targets are chosen among alive non-spectators (`role != 'spectator'`), excluding self.
- If there are no valid targets (attacker is last alive), no attack is sent.

Algorithm:

- `random`: uniform random among valid targets.
- `attackers`:
  - Maintain a per-player set of recent attackers with `lastAttackedAt`.
  - Candidate set = attackers where `now - lastAttackedAt <= 20s` and attacker is still a valid target.
  - If empty, fall back to `random`.
- `topScore`:
  - Choose valid target with highest `score`.
  - Tie-break randomly.
- `nearDeath`:
  - Choose valid target with highest `stackSize / stackLimit`.
  - Tie-break randomly.

If the chosen target becomes invalid between selection and application (e.g., eliminated), fall back to `random`.

### 8.5 Problems, Stack, and Elimination (MVP)

This section defines the authoritative server behavior for problem assignment.

Definitions:

- Each player has:
  - `currentProblem` (active in editor)
  - `queued` (LIFO stack), where newest is at index 0
- `stackSize` counts queued problems only (does not include `currentProblem`).

Match start:

- On match start, each player receives:
  - 1 `currentProblem`
  - `startingQueued` problems in `queued`
  - `code = currentProblem.starterCode`, `codeVersion = 1`
  - `revealedHints = []`

Timed incoming problems:

- While alive, each player receives new problems at a server-defined cadence.
- Recommended defaults:
  - warmup: every 90s
  - main: every 60s
- Effective interval = baseIntervalSec × `memoryLeakMultiplier` × `rateLimiterMultiplier`
  - memoryLeakMultiplier = 0.5 while `activeDebuff.type="memoryLeak"`, else 1
  - rateLimiterMultiplier = 2 while `activeBuff.type="rateLimiter"`, else 1
- New problems are pushed onto the top of `queued`.
- Sampling rule: avoid repeating a problem for the same player until the bank is exhausted (repeats allowed after).

Garbage:

- `isGarbage: true` problems are worth 0 points and never trigger attacks.
- Garbage problems are still pushed onto `queued` and can eliminate players via overflow.

Overflow & elimination:

- If inserting a new queued problem would make `stackSize > stackLimit`, the player is eliminated immediately:
  - `status = "eliminated"`
  - further `RUN_CODE`, `SUBMIT_CODE`, `SPEND_POINTS`, and `CODE_UPDATE` are rejected with `PLAYER_ELIMINATED`

Private state updates:

- Whenever a player’s private state changes (`currentProblem`, `queued`, `code`, `revealedHints`), the server MUST send that player an updated `ROOM_SNAPSHOT`.
- If that player is being spectated, the server MUST also update authorized spectators (via `SPECTATE_STATE` or `ROOM_SNAPSHOT`).

### 8.6 Attacks, Debuffs, and Durations (MVP)

Attack types:

- `ddos` (timed debuff): disable “Run” for 12s (submit still allowed).
- `flashbang` (timed debuff): force light mode for 25s.
- `vimLock` (timed debuff): force Vim mode ON for 12s.
- `memoryLeak` (timed debuff): double incoming problem rate for 30s.
- `garbageDrop` (instant): insert 1 garbage problem into target’s `queued`.

Duration scaling:

- The durations above are the baseline for `attackIntensity="low"`.
- If `attackIntensity="high"`, multiply timed debuff durations by 1.3 (rounded to the nearest second).

Debuff rules:

- Max concurrent timed debuffs per target: 1.
- If a timed debuff is applied while another timed debuff is active, the new debuff replaces the old one.
- Post-debuff grace: after a timed debuff ends, the target is immune to new timed debuffs for 5 seconds.
- `garbageDrop` ignores concurrency and grace (it can always apply).

On any attack application, the server SHOULD append an `EVENT_LOG_APPEND` entry.

### 8.7 Bots (Sim bots, MVP)

Bots exist to keep lobbies lively for demos.

Rules:

- Bots have `role="bot"` and never connect via WebSocket.
- Bots participate in scoring, stacks, elimination, and targeting like human players.
- Recommended bot behavior:
  - Solve time (sampled per problem):
    - easy: 30–60s
    - medium: 45–90s
    - hard: 60–120s
  - Failure rate: 20% of simulated submissions fail.
  - Targeting mode: always `random`.
  - Shop: never buys items.
  - Code: not meaningful; spectators MAY spectate bots, but `code` can be a placeholder.

## 9. Persistence (Supabase)

Persistence exists to power the end-of-game screen and leaderboards.

### 9.1 Tables

**`matches`**

- `id` (text, PK) — `matchId`
- `room_id` (text)
- `started_at` (timestamptz)
- `ended_at` (timestamptz)
- `end_reason` (text) — `lastAlive` | `timeExpired`
- `settings` (jsonb)

**`match_players`**

- `match_id` (text, FK → `matches.id`)
- `player_id` (text)
- `username` (text)
- `role` (text) — `player` | `bot`
- `score` (int)
- `rank` (int)
- `eliminated_at` (timestamptz, nullable)

Composite PK recommended: (`match_id`, `player_id`).

### 9.2 Write flow

- PartyKit server writes one `matches` row + many `match_players` rows when the match ends.
- Server includes `matchId` in `MATCH_END`, allowing clients to fetch via `GET /api/matches/:matchId`.

## 10. Open questions

- Do we want to persist full event logs to DB, or only standings?
- Should spectators be capped per room to control bandwidth?
- If code snapshots are too heavy, do we move to diffs (or Yjs) post-MVP?
