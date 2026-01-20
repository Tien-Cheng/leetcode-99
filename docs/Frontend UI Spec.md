---
title: LeetCode 99 Frontend UI Spec (MVP)
tags: [HackAndRoll2026, LeetCode99, frontend, ui]
---

# LeetCode 99 — Frontend UI Spec (MVP)

## 1. Overview & Design Principles

### Core Identity

- **"Riced workstation" aesthetic** — Inspired by modern tiling WM setups (Hyprland, i3, bspwm). Clean, dense, highly customized feel. Think r/unixporn top posts, not 1980s green-screen terminals.
- **Hacker's battlestation, not retro terminal** — Modern fonts, sharp edges, thoughtful color accents. Subtle effects are fine, but no forced scan lines or low-res nostalgia.
- **Game UI, not SaaS dashboard** — This is a competitive game. Tension, urgency, and visual feedback matter more than "clean" or "professional."
- **Information density done right** — Lots of data on screen (editor, stack, minimap, log) but never cluttered. Every pixel earns its place.

### What We're Avoiding

- **No purple gradients on white** — The hallmark of AI-generated startup slop.
- **No rounded-everything soft UI** — No pill buttons, no excessive border-radius, no "friendly" aesthetic.
- **No default SaaS fonts** — Avoid Inter, Roboto, and system UI fonts. IBM Plex (Sans/Mono) is the approved UI family for MVP.
- **No empty decorative space** — If there's whitespace, it's intentional breathing room, not filler.

### UX Priorities (ranked)

1. **Editor is king** — Code editing is 70% of gameplay. It must feel fast, responsive, and uncluttered.
2. **Stack = threat meter** — Your impending doom should be viscerally visible at all times.
3. **Minimap = battlefield awareness** — Quick glance to see who's alive, who's struggling, who's targeting you.
4. **Terminal log = game narrator** — Events scroll by like a live feed. Helps you feel connected to the match.

### Technical Constraints

- **Desktop-only MVP** — No responsive mobile layouts. Optimize for 1920x1080 minimum.
- **Chrome + Firefox support** — Avoid bleeding-edge CSS that breaks in either.
- **Performance matters** — Animations should be GPU-accelerated. No jank during code editing.
- **Keyboard-first design** — The entire game should be playable without a mouse. Keybinds must adapt when Vim mode is enabled (avoid conflicts with Vim commands).

**Input/Hotkey Policy (MVP):**

- Global game hotkeys use `Alt/Option+…` combos to avoid inserting characters into the editor.
- When a text input is focused (chat, forms), game hotkeys are disabled (except `Escape`).
- Modal overlays (Shop, Targeting menu, Tutorial) capture their own hotkeys until closed.
- Always render the currently-active hotkeys in the UI labels (so players can learn by looking).

## 2. Visual Identity

### Color Palette

| Token              | Hex       | Usage                                              |
| ------------------ | --------- | -------------------------------------------------- |
| `--bg-base`        | `#0d0d0d` | Primary background                                 |
| `--bg-surface`     | `#1a1a1a` | Elevated surfaces (panels, cards)                  |
| `--accent-primary` | `#00ffd5` | Active states, highlights, player's own indicators |
| `--accent-muted`   | `#4a5568` | Borders, inactive elements, subtle separators      |
| `--danger`         | `#ff4444` | Stack overflow, elimination, failed tests          |
| `--success`        | `#50fa7b` | Passed tests, solved problems                      |
| `--warning`        | `#ffb000` | Incoming attacks, debuff warnings                  |
| `--text-primary`   | `#e0e0e0` | Main readable text                                 |
| `--text-muted`     | `#6b7280` | Secondary info, timestamps, labels                 |

### Typography

- **Code/Editor**: IBM Plex Mono (14-16px, tight line-height for density)
- **UI text**: IBM Plex Sans for body, IBM Plex Mono for labels/headers to maintain hacker cohesion
- **Sizing scale**: 12px (small labels) → 14px (body) → 16px (code) → 20px (headers) → 28px (titles)

### Textures & Effects

- **Noise grain overlay**: 2-5% opacity over backgrounds, adds atmosphere without distraction
- **Glow effects**: Subtle `box-shadow` with accent color on interactive elements (e.g., `0 0 10px var(--accent-primary)`)
- **Sharp borders**: 1px solid borders, no rounded corners (or max 2px radius)
- **Panel gaps**: Tiling WM style — consistent 4-8px gaps between all panels

### Motion

- **Snappy transitions**: 100-150ms duration, no sluggish easing
- **Glitch effects for attacks**: Brief screen shake or RGB split when hit
- **Stack block animations**: New problems slide in from top with slight bounce
- **Micro-feedback**: Button press states, hover glows, focus outlines

### Debuff Visual Effects

| Debuff          | Visual Treatment                                                                        |
| --------------- | --------------------------------------------------------------------------------------- |
| **Flashbang**   | Invert to harsh white background, desaturated colors, high contrast — genuinely jarring |
| **Vim Lock**    | Cyan border glow on editor, `[VIM]` indicator in status bar                             |
| **DDOS**        | "Run" button disabled with pulsing red outline, static/noise overlay on button          |
| **Memory Leak** | Pulsing warning border on stack panel, accelerated incoming problem animation           |

### Implementation Notes: Tailwind CSS + daisyUI

We can use **daisyUI** as a productivity layer for common UI primitives (buttons, inputs, dropdowns, modals), while keeping the bespoke game surfaces (minimap, stack, terminal log, glitch overlays) as **custom Tailwind**.

**Guiding rule**:

- Use **daisyUI components** for: forms, settings, modals, basic buttons, inputs, loading.
- Use **custom Tailwind** for: Stack blocks, Minimap tiles, Terminal Log, game-specific overlays/animations.

**Avoiding "template UI"**:

- Prefer `btn-outline`, `btn-ghost`, `btn-dash` styles over chunky filled buttons.
- Set radiuses to near-zero and disable depth so we don't get soft "card" aesthetics.
- Avoid default `card` styling unless heavily customized.

#### daisyUI: What to Use vs Avoid

**Use daisyUI for (good fit):**

- **Forms**: `input`, `textarea`, `select`, `toggle`, `checkbox`, `radio` (Create/Join, Lobby settings)
- **Overlays**: `modal`, `dropdown`, `tooltip` (Shop, Targeting menu, help)
- **Basic actions**: `btn` variants (`btn-outline`, `btn-ghost`, `btn-dash`)
- **Status bits**: `badge` (difficulty tags), `alert` (inline errors), `loading` (spinners)

**Avoid (or heavily customize) because it reads like a web template:**

- `card` defaults (rounded + elevated)
- `navbar`/`hero` defaults (marketing-page vibe)
- `mockup-*` components (too "component library")
- Overly “friendly” presets like big filled `btn-primary` on light backgrounds

**Rule of thumb**: if a component looks like it belongs on a landing page, don’t use it here.

#### Iconography (Lucide)

Use **Lucide** (`lucide-react`) as the single icon set for the entire app.

**Why Lucide**:

- Sharp, outline-based icons that match the "riced workstation" / ops-console vibe
- Easy to theme via `currentColor` (works automatically with Flashbang theme swap)

**Usage rules**:

- **Do not mix icon libraries** (keeps stroke weight and visual language consistent).
- Use icons sparingly; prefer **text + hotkey label first**, icon second.
- Standardize icon sizing:
  - 16px: inline status indicators (host, bot, warning)
  - 20px: buttons/action bar
  - 24px: section headers (rare)
- Standardize stroke weight (recommended): `strokeWidth={2}`.
- Import icons individually to keep bundle size small (avoid importing the entire set).

**Suggested icon mapping** (non-exhaustive):

- Host: `Crown`
- Bot: `Bot`
- Target: `Crosshair`
- Timer: `Clock`
- Warning: `TriangleAlert`
- Success: `Check`
- Error: `XCircle`
- Shop: `ShoppingCart`
- Audio: `Volume2` / `VolumeX`

#### Theme Strategy (recommended)

- Default theme: `leet99` (dark riced workstation)
- Flashbang theme: `leet99-flashbang` (harsh light theme)

Implementation detail:

- Set `<html data-theme="leet99">` by default.
- When `activeDebuff.type="flashbang"`, temporarily switch to `<html data-theme="leet99-flashbang">` until the debuff ends.

#### Tailwind v4 / daisyUI v5 setup (reference)

daisyUI 5 is designed for **Tailwind CSS v4**.

A minimal `globals.css` (or equivalent) typically looks like:

```css
@import "tailwindcss";
@plugin "daisyui";
```

#### Custom daisyUI themes (recommended)

This provides both the normal theme and the Flashbang theme.

```css
@import "tailwindcss";
@plugin "daisyui";

@plugin "daisyui/theme" {
  name: "leet99";
  default: true;
  prefersdark: true;
  color-scheme: dark;

  --color-base-100: #0d0d0d;
  --color-base-200: #1a1a1a;
  --color-base-300: #141414;
  --color-base-content: #e0e0e0;

  --color-primary: #00ffd5;
  --color-primary-content: #0d0d0d;

  --color-success: #50fa7b;
  --color-warning: #ffb000;
  --color-error: #ff4444;

  --radius-selector: 0.125rem;
  --radius-field: 0.125rem;
  --radius-box: 0.125rem;

  --border: 1px;
  --depth: 0;
  --noise: 1;
}

@plugin "daisyui/theme" {
  name: "leet99-flashbang";
  default: false;
  prefersdark: false;
  color-scheme: light;

  /* Deliberately harsh */
  --color-base-100: #f0f0f0;
  --color-base-200: #e6e6e6;
  --color-base-300: #d8d8d8;
  --color-base-content: #1a1a1a;

  /* Keep accents readable on light */
  --color-primary: #00bfa6;
  --color-primary-content: #0d0d0d;

  --color-success: #12a150;
  --color-warning: #c27a00;
  --color-error: #d12b2b;

  --radius-selector: 0.125rem;
  --radius-field: 0.125rem;
  --radius-box: 0.125rem;

  --border: 1px;
  --depth: 0;
  --noise: 0;
}
```

#### Color Mapping (spec → daisyUI semantics)

|                   Spec token | daisyUI semantic        |
| ---------------------------: | ----------------------- |
| `--bg-base` / `--bg-surface` | `base-100` / `base-200` |
|           `--accent-primary` | `primary`               |
|                  `--success` | `success`               |
|                  `--warning` | `warning`               |
|                   `--danger` | `error`                 |
|             `--text-primary` | `base-content`          |

## 3. Screen Inventory

| Screen                    | Purpose                                                       | Entry Points                         |
| ------------------------- | ------------------------------------------------------------- | ------------------------------------ |
| **Landing / Home**        | Entry point with create/join options                          | Direct URL, post-match exit          |
| **Create Room**           | Host configures room settings, gets room code                 | Landing → "Create Room"              |
| **Join Room**             | Enter room code and username                                  | Landing → "Join Room", shared link   |
| **Lobby**                 | Players gather, host adds bots/adjusts settings, starts match | After create/join                    |
| **Tutorial / Onboarding** | First-time user flow explaining mechanics                     | First visit, or "How to Play" button |
| **In-Game**               | Main gameplay screen (editor, stack, minimap, log, shop)      | Lobby → host starts match            |
| **Results / End Screen**  | Match standings, winner announcement, stats                   | Match ends (time or last alive)      |
| **Spectator View**        | Read-only In-Game variant                                     | Join mid-match, or after elimination |

## 4. User Flows

### 4.1 First-Time Visitor

```
Landing → [First visit detected] → Tutorial/Onboarding → Landing → Create/Join → Lobby → Game
```

### 4.2 Create Room (Host)

```
Landing → "Create Room" → Create Room Screen (enter username, configure settings)
       → Lobby (as host, room code displayed) → Add bots (optional)
       → Adjust settings (optional) → "Start Match" → In-Game
```

### 4.3 Join Room (Player)

```
Landing → "Join Room" → Join Room Screen (enter room code + username)
       → Lobby (as player) → Wait for host → [Host starts] → In-Game
```

### 4.4 Join via Shared Link

```
Shared URL (e.g., /join/AB12CD) → Join Room Screen (code pre-filled, enter username)
                               → Lobby → Wait for host → In-Game
```

### 4.5 In-Game Loop

```
┌─────────────────────────────────────────────────────────────┐
│  Read problem → Write code → Run (public tests)            │
│       ↓                                                     │
│  [Tests fail] → See errors → Edit code → Run again         │
│       ↓                                                     │
│  [Tests pass] → Submit → [Hidden tests run]                │
│       ↓                                                     │
│  [Submit pass] → +Points → Attack sent → Next problem ─────┼──→ (loop)
│       ↓                                                     │
│  [Submit fail] → Streak reset → Edit code → Submit again   │
└─────────────────────────────────────────────────────────────┘
```

### 4.6 Getting Attacked

```
Playing → [Attack received] → Debuff applied (visual + functional effect)
       → Option A: Wait for debuff to expire
       → Option B: Open shop → "Clear Debuff" → Spend points → Debuff removed
```

### 4.7 Stack Overflow / Elimination

```
Stack grows → [stackSize approaches STACK_LIMIT] → Warning visuals intensify
           → [stackSize > STACK_LIMIT] → Eliminated → Spectator View
```

### 4.8 End of Match

```
[Time expires OR last player alive] → Results Screen (standings, stats, winner)
                                     → "Return to Lobby" (host) → Lobby (same room)
                                     → (non-host) wait for host reset, or "Exit" → Landing
```

### 4.9 Spectator Join Mid-Match

```
Join Room (during active match) → [role=spectator] → Spectator View
                                → Select player to watch → See their editor/stack
```

### 4.10 Shop Purchase

```
In-Game → Click shop icon (or hotkey) → Shop panel opens
       → Select item → [Check: score >= cost, not on cooldown]
       → Confirm purchase → Points deducted → Effect applied → Shop closes
```

## 5. Screen Specs

### 5.1 Landing / Home

**Purpose**: Entry point to the game. Calm but alive — a lobby atmosphere, not a hype screen.

**Layout**:

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                                                                 │
│                        LEETCODE 99                              │
│                   Battle Royale for Coders                      │
│                                                                 │
│                  ┌─────────────────────────┐                    │
│                  │    [C] Create Room      │                    │
│                  └─────────────────────────┘                    │
│                  ┌─────────────────────────┐                    │
│                  │    [J] Join Room        │                    │
│                  └─────────────────────────┘                    │
│                                                                 │
│                       How to Play [?]                           │
│                                                                 │
│                                                         v0.1.0  │
└─────────────────────────────────────────────────────────────────┘
```

**Elements**:

- **Title**: "LEETCODE 99" in large IBM Plex Mono, subtle cyan glow
- **Tagline**: "Battle Royale for Coders" in muted text below title (optional, can remove if too busy)
- **Create Room button**: Primary CTA, cyan border, `[C]` hotkey hint
- **Join Room button**: Secondary CTA, same style, `[J]` hotkey hint
- **How to Play**: Small text link to Tutorial, `[?]` hotkey
- **Version number**: Bottom-right corner, muted text (e.g., `v0.1.0`)

**Background**: Dark base (`--bg-base`) with subtle noise grain overlay. Optional: faint slow-moving grid lines or floating particles for atmosphere.

**Behavior**:

- First-visit detection: show prompt "First time? [Learn how to play]" or auto-redirect to Tutorial
- Keyboard navigation: `C` → Create Room, `J` → Join Room, `?` → Tutorial
- Subtle ambient animation (slow glow pulse on title, or gentle particle drift)

**Audio**: On load, fade in subtle ambient synth pad or low hum (if audio enabled)

### 5.2 Create Room

**Purpose**: Host creates a new room, sets username, configures initial settings.

**Layout**:

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                        CREATE ROOM                              │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Your Username                                          │    │
│  │  ┌─────────────────────────────────────────────────┐    │    │
│  │  │ alice                                           │    │    │
│  │  └─────────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Room Settings (optional)                               │    │
│  │  ─────────────────────────────────────────────────      │    │
│  │  Duration:         [10 min ▼]                           │    │
│  │  Difficulty:       [Moderate ▼]                         │    │
│  │  Attack Intensity: [Low ▼]                              │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│         ┌─────────────────────────────────────────┐             │
│         │         [Enter] Create Room             │             │
│         └─────────────────────────────────────────┘             │
│                                                                 │
│                    [Esc] Back to Home                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Elements**:

- **Username input**: Text field, auto-focused, 1-16 chars
- **Settings section**: Collapsible or always visible, dropdowns for each setting
- **Create button**: Primary CTA, `[Enter]` hotkey
- **Back link**: `[Esc]` returns to Landing

**Validation**:

- Username required, 1-16 chars, trimmed
- Show inline error if username invalid

**Keybinds**:
| Key | Action |
|-----|--------|
| `Enter` | Create room (if valid) |
| `Escape` | Back to Landing |
| `Tab` | Navigate between fields |

**Behavior**:

- On submit: calls `POST /api/rooms`, receives `roomId` (room code like `AB12CD`) + `playerToken` (+ `wsUrl`)
- Store `wsUrl` + `playerToken` in localStorage keyed by `roomId` for reconnect
- On success: navigate to Lobby as host
- On error: show inline error message

---

### 5.3 Join Room

**Purpose**: Player joins an existing room by code, sets username.

**Layout**:

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                         JOIN ROOM                               │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Room Code                                              │    │
│  │  ┌─────────────────────────────────────────────────┐    │    │
│  │  │ AB12CD                                          │    │    │
│  │  └─────────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Your Username                                          │    │
│  │  ┌─────────────────────────────────────────────────┐    │    │
│  │  │ bob                                             │    │    │
│  │  └─────────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│         ┌─────────────────────────────────────────┐             │
│         │           [Enter] Join Room             │             │
│         └─────────────────────────────────────────┘             │
│                                                                 │
│                    [Esc] Back to Home                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Elements**:

- **Room code input**: Text field, uppercase, auto-focused (or pre-filled if from shared link)
- **Username input**: Text field, 1-16 chars
- **Join button**: Primary CTA, `[Enter]` hotkey
- **Back link**: `[Esc]` returns to Landing

**Validation**:

- Room code required
- Username required, 1-16 chars, trimmed
- Show inline errors for invalid inputs

**Keybinds**:
| Key | Action |
|-----|--------|
| `Enter` | Join room (if valid) |
| `Escape` | Back to Landing |
| `Tab` | Navigate between fields |

**Behavior**:

- On submit: calls `POST /api/rooms/:roomId/join` (where `roomId` is the room code like `AB12CD`), receives `playerToken` (+ `wsUrl`)
- Store `wsUrl` + `playerToken` in localStorage keyed by `roomId` for reconnect
- Success (lobby phase): navigate to Lobby as player
- Success (match running): navigate to Spectator View
- Error `ROOM_NOT_FOUND`: "Room not found"
- Error `ROOM_FULL`: "Room is full"
- Error `USERNAME_TAKEN`: "Username already taken in this room"
- Error `MATCH_ALREADY_STARTED`: Prompt to join as spectator

**Shared Link Support**:

- URL like `/join/AB12CD` pre-fills room code
- Only username field needs input

---

### 5.4 Lobby

**Purpose**: Gathering space before match starts. Host configures, players wait, everyone chats.

**Layout**:

```
┌─────────────────────────────────────────────────────────────────┐
│  Room: AB12CD  [Copy Link]                    [Leave Room]      │
├───────────────────────────────────┬─────────────────────────────┤
│                                   │  ┌─────────────────────────┐│
│  Players (4/99)                   │  │ [CHAT]                  ││
│  ┌────────┐ ┌────────┐ ┌────────┐ │  │                         ││
│  │ alice  │ │  bob   │ │ Bot 1  │ │  │ > alice joined          ││
│  │ [HOST] │ │        │ │ (Med) X│ │  │ > bob joined            ││
│  └────────┘ └────────┘ └────────┘ │  │ > Host added Bot 1      ││
│  ┌────────┐ ┌╌╌╌╌╌╌╌╌┐ ┌╌╌╌╌╌╌╌╌┐ │  │                         ││
│  │ Bot 2  │ ╎        ╎ ╎        ╎ │  │                         ││
│  │ (Hard)X│ ╎ empty  ╎ ╎ empty  ╎ │  │                         ││
│  └────────┘ └╌╌╌╌╌╌╌╌┘ └╌╌╌╌╌╌╌╌┘ │  │                         ││
│                                   │  ├─────────────────────────┤│
│  ─────────────────────────────    │  │ [Enter message...]      ││
│  Settings (Host only)             │  └─────────────────────────┘│
│  Duration: [10 min ▼]             │                             │
│  Difficulty: [Moderate ▼]         │                             │
│  Attack Intensity: [Low ▼]        │                             │
│  ─────────────────────────────    │                             │
│                                   │                             │
│  [B] Add Bot        [S] Start Match                             │
└─────────────────────────────────────────────────────────────────┘
```

**Elements**:

_Header_

- **Room code**: Large, prominent (e.g., "Room: AB12CD")
- **Copy Link button**: Copies shareable URL to clipboard, shows "Copied!" feedback
- **Leave Room button**: Returns to Landing (with confirmation if host)

_Player Grid_

- **Player tiles**: Sharp-bordered rectangles displaying username
- **Host indicator**: Crown icon or `[HOST]` label inside tile
- **Bot tiles**: Distinct border color (amber `--warning`), difficulty label (e.g., "Easy", "Med", "Hard"), `X` button to remove (host only)
- **Empty slots**: Dashed border, muted "empty" text, shows available capacity

_Settings Panel (Host Only)_

- **Match duration**: Dropdown (6-10 min)
- **Difficulty profile**: Dropdown (Beginner / Moderate / Competitive)
- **Attack intensity**: Dropdown (Low / High)
- **Non-hosts**: See settings as read-only text (no dropdowns)
- **Live sync**: Changes broadcast immediately via `SETTINGS_UPDATE`

_Chat Panel_

- **Message list**: Terminal-style, monospace, newest at bottom
- **System messages**: Styled differently (muted color, no username)
- **Input field**: Bottom of chat panel, `Enter` to send
- **Timestamps**: Optional, muted
- **Backend contract**: send `SEND_CHAT`, receive `CHAT_APPEND`; initial backlog comes from `ROOM_SNAPSHOT.payload.chat`
- **MVP scope**: lobby-only; once match starts, treat chat as read-only (or hide input)

_Host Actions_

- **Add Bot button**: `[B]` hotkey, adds one bot (cycles difficulty or shows selector)
- **Start Match button**: `[S]` hotkey, prominent cyan, only enabled with >= 2 players/bots

**Keybinds**:
| Key | Action |
|-----|--------|
| `Enter` | Focus chat input (if not focused) / Send message (if focused) |
| `Escape` | Unfocus chat / Leave room confirmation |
| `S` | Start match (host only) |
| `B` | Add bot (host only) |

**Behavior**:

- Player joins: tile appears, system message in chat
- Host leaves: auto-transfer to next player, system message
- Settings change: all players see update in real-time
- Match starts: transition to In-Game screen

**Audio**:

- Player join/leave: subtle notification sound
- Start match: countdown beep or "match starting" sound

### 5.5 Tutorial / Onboarding

**Purpose**: Quick interactive walkthrough teaching core mechanics. Accessible on first visit and via "How to Play".

**Format**: Overlay on a mock game screen, 5-7 interactive steps, ~30-60 seconds total.

**Layout**:

```
┌─────────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                         │    │
│  │              [Mock game screen at 40% opacity]          │    │
│  │                                                         │    │
│  │    ╔═══════════════════════════════════════════╗        │    │
│  │    ║  ┌─────────────────────────────────────┐  ║        │    │
│  │    ║  │  ▶ STEP 3 of 6                      │  ║        │    │
│  │    ║  │                                     │  ║        │    │
│  │    ║  │  Press [Alt+R] to run your code     │  ║        │    │
│  │    ║  │  against public test cases.         │  ║        │    │
│  │    ║  │                                     │  ║        │    │
│  │    ║  │  Try it now!                        │  ║        │    │
│  │    ║  └─────────────────────────────────────┘  ║        │    │
│  │    ╚═══════════════════════════════════════════╝        │    │
│  │                         ↓                               │    │
│  │                 ┌──────────────┐ ← spotlight            │    │
│  │                 │  [Alt+R] Run │   (glowing border)     │    │
│  │                 └──────────────┘                        │    │
│  │                                                         │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ○ ○ ● ○ ○ ○        (progress dots)       [Esc] Skip Tutorial   │
└─────────────────────────────────────────────────────────────────┘
```

**Tutorial Steps**:

| Step | Highlight     | Text                                                            | Interaction             |
| ---- | ------------- | --------------------------------------------------------------- | ----------------------- |
| 1    | Problem panel | "Read the problem. Write code to solve it."                     | `Enter` to continue     |
| 2    | Editor        | "Write your solution here."                                     | `Enter` to continue     |
| 3    | Run button    | "Press `Alt/Option+R` to test against public test cases."       | Wait for `Alt/Option+R` |
| 4    | Submit button | "Press `Alt/Option+S` to submit for points and attack!"         | Wait for `Alt/Option+S` |
| 5    | Stack panel   | "Problems pile up. If your stack overflows, you're eliminated." | `Enter` to continue     |
| 6    | Minimap       | "Solve problems to attack others. Last one standing wins."      | `Enter` to continue     |
| 7    | —             | "You're ready. Good luck."                                      | `Enter` to close        |

**Visual Treatment**:

- **Dimmed background**: Mock game screen at 40% opacity
- **Spotlight**: Highlighted element has bright cyan border glow, rest is dimmed
- **Callout box**: Sharp-bordered tooltip near highlighted element
- **Progress dots**: Bottom of overlay, current step filled

**Keybinds**:
| Key | Action |
|-----|--------|
| `Enter` / `Space` | Advance to next step (if not waiting for specific key) |
| `Escape` | Skip tutorial entirely |
| Step-specific keys | `R`, `S`, etc. — tutorial waits for correct key |

**Behavior**:

- First visit: auto-trigger tutorial (can skip)
- "How to Play" from Landing: opens tutorial
- Completing or skipping: returns to previous screen (Landing or Lobby)
- Store completion in localStorage to avoid re-triggering

**Audio**:

- Step advance: subtle click/blip
- Tutorial complete: short success chime

### 5.6 In-Game

**Purpose**: The main gameplay screen. Players spend 90% of their time here.

**Layout**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ⏱ 07:32                                           ┌───────────────────┐   │
│                                                     │ MINIMAP           │   │
├─────────────────┬───────────────────────────────────┤ ┌──┐┌──┐┌──┐┌──┐ │   │
│ PROBLEM         │                                   │ │al││bo││c ││d │ │   │
│ ────────────────│                                   │ └──┘└──┘└──┘└──┘ │   │
│ Two Sum [EASY]  │  def two_sum(nums, target):       │ ┌──┐┌──┐┌──┐┌──┐ │   │
│                 │      # your code here             │ │⊕ ││░░││  ││  │ │   │
│ Given an array  │      pass                         │ └──┘└──┘└──┘└──┘ │   │
│ of integers...  │                                   └───────────────────┘   │
│                 │                                   ┌───────────────────┐   │
│ ┌─────────────┐ │                                   │ STACK (4/10)      │   │
│ │ Signature   │ │                                   │ ┌─────────────────┐   │
│ │ def two_sum │ │                                   │ │ ███ Reverse Str │   │
│ │ (nums, tgt) │ │                                   │ ├─────────────────┤   │
│ │ -> list[int]│ │                                   │ │ ███ Valid Paren │   │
│ └─────────────┘ │                                   │ ├─────────────────┤   │
│                 │                                   │ │ ░░░ Garbage #1  │   │
│ ┌─────────────┐ │                                   │ ├─────────────────┤   │
│ │ Public Tests│ │                                   │ │ ███ Two Pointers│   │
│ │ ✓ Test 1    │ │                                   │ ├╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┤   │
│ │ ✗ Test 2    │ │                                   │ │ ╌╌╌ OVERFLOW ╌╌ │   │
│ │ ○ Test 3    │ │                                   │ └─────────────────┘   │
│ └─────────────┘ │                                   └───────────────────────┘
├─────────────────┴───────────────────────────────────────────────────────────┤
│ TERMINAL LOG                                                                │
│ > alice solved Easy (+5) and sent Garbage Drop to bob                       │
│ > You received Flashbang from charlie!                                      │
│ > dave was eliminated (stack overflow)                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│ [Alt+R] Run   [Alt+S] Submit   [Alt+B] Shop   │  Score: 45  │  Streak: 2  │  [VIM]     │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Panel Breakdown**:

#### Editor (Center, 50-60% width)

- **Monaco editor**: Syntax highlighting, IBM Plex Mono, 16px font
- **Pre-filled**: Starter code with function signature
- **Vim toggle**: `[Alt+V]` to toggle (when not Vim Locked)
- **Focus**: Editor has focus by default on screen load

#### Problem Panel (Left)

- **Title + difficulty badge**: Color-coded (`--success` easy, `--warning` medium, `--danger` hard)
- **Prompt**: Scrollable description
- **Signature**: Highlighted code block
- **Public tests**: Collapsible list, shows input/expected output
- **Test results**: Updated after Run — ✓ pass, ✗ fail, ○ not run

#### Stack Panel (Right)

- **Vertical stack**: Newest problem at top (index 0)
- **Block contents**: Difficulty bar (colored) + problem title
- **Garbage indicator**: Striped or dimmed pattern, distinct from normal problems
- **Stack count**: "STACK (4/10)" header
- **Overflow line**: Dashed line at STACK_LIMIT threshold
- **Warning state**: Panel border pulses red when `stackSize >= STACK_LIMIT - 2`

#### Minimap (Top-right corner)

- **Compact grid**: Small tiles for each player
- **Tile contents**: First 2 chars of username or icon
- **Status colors**:
  - Green (`--success`): coding normally
  - Red (`--danger`): error state (last run/submit failed)
  - Amber (`--warning`): under attack (has active debuff)
  - Gray: eliminated
- **Self indicator**: Cyan border on own tile
- **Target indicator**: Small crosshair or dot on current target

#### Terminal Log (Bottom)

- **Scrolling feed**: Newest at bottom, auto-scroll
- **Message types**:
  - Info (white): general events
  - Warning (amber): attacks received, stack warnings
  - Danger (red): eliminations, failures
  - Success (green): problems solved, attacks sent
- **Format**: `> [message]` — compact, no timestamps by default

#### Action Bar (Bottom)

- **Run button**: `[Alt+R]` — runs public tests (disabled during DDOS)
- **Submit button**: `[Alt+S]` — submits for scoring
- **Shop button**: `[Alt+B]` — opens shop overlay
- **Score display**: Current points
- **Streak display**: Current streak count
- **Vim indicator**: `[VIM]` when Vim mode active
- **Timer**: Match time remaining (top of screen, prominent)

#### Shop Overlay (Hidden by default)

```
┌─────────────────────────────────────┐
│  SHOP                    [Esc] Close│
│  ─────────────────────────────────  │
│  Your Score: 45                     │
│                                     │
│  [1] Clear Debuff .......... 10 pts │
│  [2] Memory Defrag ......... 10 pts │
│  [3] Skip Problem .......... 15 pts │
│  [4] Rate Limiter .......... 10 pts │
│  [5] Hint ................... 5 pts │
│                                     │
└─────────────────────────────────────┘
```

- **Modal overlay**: Dims game behind, doesn't pause
- **Quick purchase**: Number keys `1-5` to buy
- **Disabled items**: Grayed out if insufficient score or on cooldown
- **Cooldown indicator**: Shows remaining time if applicable

#### Debuff Visual States

| Debuff          | Visual Effect                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------- |
| **DDOS**        | Run button disabled, pulsing red border, "BLOCKED" overlay on button                              |
| **Flashbang**   | Entire UI inverts: white background, dark text, desaturated colors — harsh and jarring            |
| **Vim Lock**    | Editor forced to Vim, cyan glow on editor border, `[VIM LOCKED]` in status bar (can't toggle off) |
| **Memory Leak** | Stack panel pulses amber, incoming problem animation speeds up, `[MEMORY LEAK]` warning           |

#### Keybinds

**Normal Mode (Vim OFF)**:
| Key | Action |
|-----|--------|
| `Alt/Option+R` | Run code (public tests) |
| `Alt/Option+S` | Submit code |
| `Alt/Option+B` | Open/close shop |
| `Alt/Option+T` | Open targeting mode menu |
| `Alt/Option+V` | Toggle Vim mode |
| `F5` | Run code (backup binding) |
| `F6` | Submit code (backup binding) |
| `1-5` | Quick-buy shop item (when shop open) |
| `Escape` | Close shop / close menus (or exit Vim insert mode) |

**Vim Mode (Vim ON or Vim Locked)**:

- Use the **same bindings** as above (`Alt/Option+…`). Avoid `Ctrl+R` / `Ctrl+S` because browsers reserve them (refresh/save).

#### Targeting Mode Menu

**Goal**: Let players change targeting mode without leaving the editor.

- Open/close: `Alt/Option+T`
- UI: small modal anchored near the minimap (top-right), so the choice feels "battlefield"-related.

```
┌───────────────────────────┐
│ TARGETING                 │
│ ───────────────────────── │
│ (•) Random                │
│ ( ) Attackers             │
│ ( ) Top Score             │
│ ( ) Near Death            │
│                           │
│ [Enter] Select   [Esc]Close│
└───────────────────────────┘
```

**Keyboard navigation**:

- `↑/↓` to move selection
- `Enter` to confirm
- `Esc` to close without changing

**Current mode visibility**:

- Action bar shows a small label: `Target: Random` (muted) or an icon next to minimap.

**Audio**:

- Run success: short positive blip
- Run failure: error buzz
- Submit success: satisfying chime + attack whoosh
- Submit failure: heavier error sound
- Attack received: impact sound + debuff-specific effect
- Stack warning: tension drone when near overflow
- Elimination: dramatic sound (yours or others)

### 5.7 Results / End Screen

**Purpose**: Display match results, celebrate winner, show detailed stats, offer next actions.

**Layout**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                              🏆 WINNER 🏆                                   │
│                                                                             │
│                              ╔═══════════╗                                  │
│                              ║   alice   ║  ← 1st (gold glow)               │
│                              ║  120 pts  ║                                  │
│                              ╚═══════════╝                                  │
│                        ┌───────┐     ┌───────┐                              │
│                        │  bob  │     │charlie│  ← 2nd, 3rd (silver, bronze) │
│                        │ 95pts │     │ 80pts │                              │
│                        └───────┘     └───────┘                              │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ STANDINGS                                                              │ │
│  ├────┬──────────┬───────┬────────┬──────────┬──────────┬────────────────┤ │
│  │ #  │ Player   │ Score │ Solved │ Atk Sent │ Atk Recv │ Status         │ │
│  ├────┼──────────┼───────┼────────┼──────────┼──────────┼────────────────┤ │
│  │ 1  │ alice    │  120  │ 12     │ 8        │ 3        │ Survived       │ │
│  │ 2  │ bob      │   95  │ 9      │ 6        │ 5        │ Survived       │ │
│  │ 3  │ charlie  │   80  │ 8      │ 5        │ 4        │ Survived       │ │
│  │ 4  │ you ◀    │   65  │ 6      │ 4        │ 7        │ Eliminated #4  │ │
│  │ 5  │ Bot 1 🤖 │   40  │ 4      │ 3        │ 6        │ Eliminated #3  │ │
│  └────┴──────────┴───────┴────────┴──────────┴──────────┴────────────────┘ │
│                                                                             │
│  ┌─────────────────────────────┐  ┌─────────────────────────────────────┐   │
│  │ YOUR STATS                  │  │ MATCH SUMMARY                       │   │
│  │ Problems: 2E / 3M / 1H      │  │ Duration: 10:00                     │   │
│  │ Accuracy: 6/9 (67%)         │  │ End: Time expired                   │   │
│  │ Best Streak: 4              │  │ Total solved: 39 problems           │   │
│  │ Time Survived: 8:32         │  │ Players: 5 (2 humans, 3 bots)       │   │
│  └─────────────────────────────┘  └─────────────────────────────────────┘   │
│                                                                             │
│              [Enter] Return to Lobby          [Esc] Exit                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Elements**:

#### Winner Announcement

- **"WINNER" header**: Large text with trophy icon
- **Winner tile**: Largest, gold accent (`#ffd700`), glow effect, crown icon
- **Animation**: Staggered reveal — 3rd appears, then 2nd, then 1st with fanfare

#### Podium (Top 3)

| Place | Visual Treatment                                          |
| ----- | --------------------------------------------------------- |
| 1st   | Gold accent, large tile, glow/pulse animation, crown icon |
| 2nd   | Silver accent (`#c0c0c0`), medium tile, subtle glow       |
| 3rd   | Bronze accent (`#cd7f32`), medium tile, subtle glow       |

#### Standings Table

- **Columns (MVP minimum)**: Rank, Player, Score, Status
- **Optional (stretch)**: Problems Solved, Attacks Sent/Received, accuracy, elimination order
- **Self highlight**: Cyan border/background on your row, `◀` marker
- **Bot indicator**: 🤖 icon or `[BOT]` label
- **Eliminated players**: Show elimination order (e.g., "Eliminated #3")
- **Survived players**: "Survived" status

#### Your Stats Panel (optional)

- MVP: OK to omit this panel unless stats are tracked.
- If implemented: problems by difficulty, accuracy, best streak, time survived.

#### Match Summary Panel

- **Duration**: Actual match length
- **End reason**: "Time expired" or "Last player standing"
- **Total solved**: Sum of all problems solved by all players
- **Player count**: Breakdown of humans vs bots

#### Actions

- **Return to Lobby**: Primary CTA, `[Enter]` hotkey (host-only; non-hosts see disabled/wait state)
- **Exit**: Secondary, `[Esc]` hotkey, returns to Landing

**Keybinds**:
| Key | Action |
|-----|--------|
| `Enter` | Return to Lobby |
| `Escape` | Exit to Landing |

**Behavior**:

- Results data fetched via `GET /api/matches/:matchId` or from `MATCH_END` payload
- If `me.isHost=true`, "Return to Lobby" sends `RETURN_TO_LOBBY` over PartyKit and waits for an authoritative `ROOM_SNAPSHOT` with `match.phase="lobby"`
- If non-host, show a waiting state until host resets, or allow "Exit" to landing
- Animation sequence: background dims → podium reveals (3rd, 2nd, 1st) → standings fade in → stats appear
- If you won: extra celebration (screen flash, confetti particles, special sound)

**Audio**:

- Podium reveal: Drum roll or building tension
- Winner reveal: Triumphant fanfare/synth stinger
- Your win: Extra celebratory flourish
- Your loss: Softer, neutral resolution tone

### 5.8 Spectator View

**Purpose**: Read-only view for spectators or eliminated players to watch others play.

**Layout**: Same as In-Game (5.6), with modifications:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ⏱ 07:32              SPECTATING: alice                    [Tab] Switch    │
│                                                     ┌───────────────────┐   │
├─────────────────┬───────────────────────────────────┤ MINIMAP           │   │
│ PROBLEM         │                                   │ ┌──┐┌──┐┌──┐┌──┐ │   │
│ [alice's view]  │  [alice's code - read only]       │ │▶a││bo││c ││d │ │   │
│                 │                                   │ └──┘└──┘└──┘└──┘ │   │
│                 │                                   └───────────────────┘   │
│                 │                                   ┌───────────────────┐   │
│                 │                                   │ STACK (alice)     │   │
│                 │                                   │ [alice's stack]   │   │
│                 │                                   └───────────────────┘   │
├─────────────────┴───────────────────────────────────────────────────────────┤
│ TERMINAL LOG (global events)                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│ SPECTATOR MODE  │  Watching: alice (Score: 45)  │  [Tab] Switch Player     │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Differences from In-Game**:

- **Header**: Shows "SPECTATING: [username]" instead of timer alone
- **Editor**: Read-only, shows spectated player's code (live updates via `CODE_UPDATE`)
- **Problem panel**: Shows spectated player's current problem
- **Stack panel**: Shows spectated player's stack
- **Action bar**: No Run/Submit/Shop buttons — replaced with spectator controls
- **Minimap**: Highlights spectated player with `▶` marker; click tiles to switch

**Spectator Controls**:

- **Switch player**: `[Tab]` cycles through alive players
- **Click minimap tile**: Switch to that player
- **Player dropdown**: Alternative way to select who to watch

**Keybinds**:
| Key | Action |
|-----|--------|
| `Tab` | Switch to next alive player |
| `Shift+Tab` | Switch to previous alive player |
| `1-9` | Quick-switch to player by minimap position |
| `Escape` | Exit to Landing (if spectator) |

**Behavior**:

- Spectators receive `SPECTATE_STATE` with target's full view (problem, code, stack, hints)
- Code updates stream in real-time
- When spectated player is eliminated, auto-switch to another alive player
- Match ends: transition to Results screen

**Entry Points**:

- Join room mid-match → auto-assigned `role=spectator`
- Eliminated during match → transition to Spectator View
- On elimination: brief "YOU WERE ELIMINATED" overlay, then fade to Spectator View

**Audio**:

- Same as In-Game, but muted or reduced volume (spectator is passive)
- Elimination sound when spectated player dies

## 6. Component Inventory

### 6.1 Core Components

#### Button

```
┌─────────────────────┐
│  [Alt+R] Run Code   │  ← Primary: cyan border, glow on hover
└─────────────────────┘

┌─────────────────────┐
│  Leave Room         │  ← Secondary: muted border, subtle hover
└─────────────────────┘

┌─────────────────────┐
│  Run (BLOCKED)      │  ← Disabled: grayed out, no hover effect
└─────────────────────┘
```

| Variant   | Border             | Background     | Text             | Hover            |
| --------- | ------------------ | -------------- | ---------------- | ---------------- |
| Primary   | `--accent-primary` | transparent    | `--text-primary` | Glow effect      |
| Secondary | `--accent-muted`   | transparent    | `--text-muted`   | Border brightens |
| Disabled  | `--accent-muted`   | `--bg-surface` | `--text-muted`   | None             |
| Danger    | `--danger`         | transparent    | `--danger`       | Red glow         |

- Sharp corners (0-2px radius max)
- Hotkey hint in brackets: `[R]`, `[S]`, etc.
- Padding: 8px 16px
- Font: IBM Plex Mono

#### Input

```
┌─────────────────────────────────────┐
│ Username                            │  ← Label
├─────────────────────────────────────┤
│ alice                               │  ← Value
└─────────────────────────────────────┘
```

| State    | Border             | Effect                     |
| -------- | ------------------ | -------------------------- |
| Default  | `--accent-muted`   | —                          |
| Focus    | `--accent-primary` | Subtle glow                |
| Error    | `--danger`         | Red glow, error text below |
| Disabled | `--accent-muted`   | Dimmed background          |

- Sharp corners
- Monospace font for code-like inputs
- Error message appears below in `--danger` color

#### Dropdown / Select

```
┌─────────────────────────────────────┐
│ Moderate                          ▼ │
└─────────────────────────────────────┘
```

- Same styling as Input
- Dropdown arrow indicator
- Options panel: same dark surface, hover highlight

#### Panel

```
╔═══════════════════════════════════════╗
║ PANEL TITLE                           ║
╠═══════════════════════════════════════╣
║                                       ║
║  Panel content goes here              ║
║                                       ║
╚═══════════════════════════════════════╝
```

- Background: `--bg-surface`
- Border: 1px `--accent-muted`
- Title bar: Optional, slightly darker or with bottom border
- Gaps: 4-8px between adjacent panels (tiling WM style)

#### Tile (Player)

```
┌────────────┐     ┌────────────┐     ┌────────────┐
│   alice    │     │  Bot 1   X │     ╎            ╎
│   [HOST]   │     │   (Med)    │     ╎   empty    ╎
└────────────┘     └────────────┘     └╌╌╌╌╌╌╌╌╌╌╌╌┘
   Human            Bot                 Empty slot
```

| Type          | Border                  | Indicator                       |
| ------------- | ----------------------- | ------------------------------- |
| Human (self)  | `--accent-primary`      | Cyan glow                       |
| Human (other) | `--accent-muted`        | —                               |
| Host          | `--accent-muted`        | Crown icon or `[HOST]`          |
| Bot           | `--warning`             | Difficulty label, `X` to remove |
| Empty         | Dashed `--accent-muted` | "empty" text                    |

### 6.2 Game Components

#### Monaco Editor Wrapper

**Configuration**:

- Theme: Custom dark theme matching `--bg-surface`, `--text-primary`
- Font: IBM Plex Mono, 16px
- Language: Python
- Minimap: Disabled (we have our own minimap)
- Line numbers: Enabled
- Word wrap: Off

**Vim Integration**:

- Uses `monaco-vim` package
- Toggle via `Alt/Option+V` (when not Vim Locked)
- Status line shows current Vim mode (NORMAL, INSERT, VISUAL)

**States**:
| State | Effect |
|-------|--------|
| Normal | Standard editing |
| Vim Locked | Forced Vim mode, cyan border glow, can't toggle off |
| Read-only (Spectator) | No cursor, grayed slightly |

#### Problem Display

```
┌─────────────────────────────────────┐
│ Two Sum                      [EASY] │  ← Title + difficulty badge
├─────────────────────────────────────┤
│ Given an array of integers nums     │
│ and an integer target, return       │  ← Prompt (scrollable)
│ indices of the two numbers...       │
├─────────────────────────────────────┤
│ def two_sum(nums: list[int],        │
│             target: int)            │  ← Signature (code block)
│     -> list[int]:                   │
├─────────────────────────────────────┤
│ ▼ Public Tests                      │  ← Collapsible
│   ✓ Test 1: [2,7,11], 9 → [0,1]    │
│   ✗ Test 2: [3,2,4], 6 → [1,2]     │
│   ○ Test 3: [3,3], 6 → [0,1]       │
└─────────────────────────────────────┘
```

**Difficulty Badge Colors**:
| Difficulty | Color |
|------------|-------|
| Easy | `--success` (green) |
| Medium | `--warning` (amber) |
| Hard | `--danger` (red) |
| Garbage | Striped pattern, muted |

**Test Result Icons**:

- ✓ Passed: `--success`
- ✗ Failed: `--danger`
- ○ Not run: `--text-muted`

#### Stack Block

```
┌─────────────────────┐
│ ██ Reverse String   │  ← Normal (difficulty color bar + title)
├─────────────────────┤
│ ░░ Garbage #1       │  ← Garbage (striped, dimmed)
└─────────────────────┘
```

- Left edge: Colored bar indicating difficulty
- Title: Problem name, truncated if too long
- Garbage: Striped pattern or lower opacity

#### Stack Panel

```
┌─────────────────────────┐
│ STACK (7/10)            │  ← Header with count
├─────────────────────────┤
│ ┌─────────────────────┐ │
│ │ ██ New Problem      │ │  ← Index 0 (top/newest)
│ ├─────────────────────┤ │
│ │ ██ Another One      │ │
│ ├─────────────────────┤ │
│ │ ░░ Garbage          │ │
│ ├─────────────────────┤ │
│ │ ██ Problem 4        │ │
│ ├╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┤ │  ← OVERFLOW LINE (dashed)
│ │ ██ Problem 5        │ │
│ └─────────────────────┘ │
└─────────────────────────┘
```

**Warning States**:
| Condition | Effect |
|-----------|--------|
| `stackSize >= STACK_LIMIT - 2` | Panel border pulses red |
| `stackSize >= STACK_LIMIT - 1` | Faster pulse, warning sound |
| Memory Leak active | Amber pulse, `[MEMORY LEAK]` badge |

**Animations**:

- New problem: Slides in from top with bounce
- Problem removed (solved/skipped): Fades out or slides away

#### Minimap

```
┌───────────────────┐
│ MINIMAP           │
│ ┌──┐┌──┐┌──┐┌──┐ │
│ │al││bo││ch││da│ │  ← 2-char username abbreviation
│ └──┘└──┘└──┘└──┘ │
│ ┌──┐┌──┐┌──┐┌──┐ │
│ │⊕ ││░░││  ││  │ │  ← ⊕ = self, ░░ = under attack
│ └──┘└──┘└──┘└──┘ │
└───────────────────┘
```

**Tile Status Colors**:
| Status | Color | Icon |
|--------|-------|------|
| Coding (normal) | `--success` | — |
| Error (last test failed) | `--danger` | — |
| Under attack (debuff active) | `--warning` | Glitch effect |
| Eliminated | Gray | Strikethrough or X |
| Self | Cyan border | `⊕` or highlight |
| Current target | — | Crosshair overlay |

**Interactions**:

- Hover: Show full username tooltip
- Click: Set as target (or switch spectate target)

#### Terminal Log

```
┌─────────────────────────────────────────────────────┐
│ TERMINAL LOG                                        │
├─────────────────────────────────────────────────────┤
│ > alice solved Easy (+5) and sent Garbage Drop      │
│ > You received Flashbang from bob!                  │  ← Warning color
│ > charlie was eliminated (stack overflow)           │  ← Danger color
│ > You solved Medium (+10)                           │  ← Success color
└─────────────────────────────────────────────────────┘
```

**Message Types**:
| Type | Color | Example |
|------|-------|---------|
| Info | `--text-primary` | "Match started" |
| Success | `--success` | "You solved Easy (+5)" |
| Warning | `--warning` | "You received Flashbang!" |
| Danger | `--danger` | "Player eliminated" |
| System | `--text-muted` | "alice joined the room" |

**Behavior**:

- Auto-scroll to newest (with option to pause scroll on hover)
- Max ~50 visible messages, older ones removed
- Prefix: `> ` for consistency

#### Shop Modal

```
┌─────────────────────────────────────┐
│  SHOP                    [Esc] Close│
│  ─────────────────────────────────  │
│  Your Score: 45                     │
│                                     │
│  [1] Clear Debuff .......... 10 pts │  ← Available
│  [2] Memory Defrag ......... 10 pts │  ← Available
│  [3] Skip Problem .......... 15 pts │  ← Grayed (insufficient)
│  [4] Rate Limiter .. 10 pts (30s)   │  ← Cooldown showing
│  [5] Hint ................... 5 pts │  ← Available
│                                     │
└─────────────────────────────────────┘
```

**Item States**:
| State | Appearance |
|-------|------------|
| Available | Normal text, hotkey highlighted |
| Insufficient score | Grayed out, cost in red |
| On cooldown | Grayed out, remaining time shown |
| Not applicable | Hidden or grayed (e.g., Clear Debuff with no debuff) |

**Behavior**:

- Opens with `Alt/Option+B`
- Number keys `1-5` for quick purchase
- `Escape` to close
- Dims game behind (doesn't pause)

**Backend Contract (MVP)**

Shop items MUST match backend `ShopItem` identifiers from the Backend API Spec:

```ts
type ShopItem =
  | "clearDebuff"
  | "memoryDefrag"
  | "skipProblem"
  | "rateLimiter"
  | "hint";
```

**Source of truth**:

- Prices and cooldowns are server-defined via `RoomSnapshot.shopCatalog`.
- UI may show the _recommended defaults_ below as placeholders, but MUST render costs from `shopCatalog` when present.

**Canonical ordering + hotkeys** (stable ordering so muscle memory works):

| Hotkey | Label         | `ShopItem`     | Default cost | Cooldown (`shopCatalog.cooldownSec`) | Disable when (client-side)     |
| ------ | ------------- | -------------- | ------------ | ------------------------------------ | ------------------------------ |
| `1`    | Clear Debuff  | `clearDebuff`  | 10           | —                                    | No active debuff               |
| `2`    | Memory Defrag | `memoryDefrag` | 10           | —                                    | (Optional) no garbage in stack |
| `3`    | Skip Problem  | `skipProblem`  | 15           | —                                    | —                              |
| `4`    | Rate Limiter  | `rateLimiter`  | 10           | 60 (recommended)                     | On cooldown                    |
| `5`    | Hint          | `hint`         | 5            | —                                    | No more hints available        |

**Request**:

- Buying an item sends `SPEND_POINTS`:

```json
{ "type": "SPEND_POINTS", "payload": { "item": "skipProblem" } }
```

**Success handling**:

- Close the shop modal.
- Play purchase success SFX.
- Append a short system line to Terminal Log (e.g., `> Bought Skip Problem (-15)`).

**Failure handling** (server `ERROR` response to `SPEND_POINTS`):

| Error code           | UI treatment                                                                          |
| -------------------- | ------------------------------------------------------------------------------------- |
| `INSUFFICIENT_SCORE` | Keep modal open, flash the cost in red + denied SFX                                   |
| `ITEM_ON_COOLDOWN`   | Keep modal open, show "Cooldown" label; if `retryAfterMs` is provided, show countdown |
| `BAD_REQUEST`        | Keep modal open, show inline message (e.g., "No debuff to clear" / "No more hints")   |
| `PLAYER_ELIMINATED`  | Close modal and transition to Spectator View                                          |

#### Timer

```
  ⏱ 07:32
```

- Large, prominent at top of screen
- Color changes:
  - Normal: `--text-primary`
  - < 2 min: `--warning`
  - < 30 sec: `--danger`, pulsing

#### Debuff Overlays

**Flashbang**:

- Entire page color scheme inverts
- Background: harsh white (`#f0f0f0`)
- Text: dark (`#1a1a1a`)
- Borders: dark
- Duration: 25s (or until cleared)

**DDOS (Run Blocked)**:

```
┌─────────────────────┐
│  [Alt+R] Run  BLOCKED │  ← Red pulsing border
│  ░░░░░░░░░░░░░░░░░  │  ← Static/noise overlay
└─────────────────────┘
```

**Vim Lock**:

- Editor border: Cyan glow
- Status bar: `[VIM LOCKED]` indicator
- Vim toggle disabled

**Memory Leak**:

- Stack panel: Amber pulsing border
- Header badge: `[MEMORY LEAK]`
- Incoming problem animation: Faster

### 6.3 Feedback Components

#### Toast / Notification (Optional)

```
┌─────────────────────────────────────┐
│ ✓ Copied to clipboard!              │
└─────────────────────────────────────┘
```

- Brief, auto-dismiss (2-3s)
- Position: Top-right or bottom-right
- May not be needed if Terminal Log handles most feedback

#### Loading Spinner

```
  ◐ Loading...
```

- Simple spinning indicator
- Used for: Room creation, joining, code submission
- Can be inline or overlay

#### Error Message (Inline)

```
┌─────────────────────────────────────┐
│ Username                            │
├─────────────────────────────────────┤
│ ab                                  │
└─────────────────────────────────────┘
  ✗ Username must be at least 3 characters
```

- Appears below input field
- Color: `--danger`
- Icon: ✗ prefix

## 7. State Mappings

This section defines how backend state (from WebSocket events) maps to UI rendering.

### 7.1 Player Status → UI

| `PlayerStatus` | Minimap Tile        | Screen         | Additional Effects                           |
| -------------- | ------------------- | -------------- | -------------------------------------------- |
| `lobby`        | —                   | Lobby screen   | —                                            |
| `coding`       | Green (`--success`) | In-Game        | Normal UI                                    |
| `error`        | Red (`--danger`)    | In-Game        | Last run/submit failed indicator             |
| `underAttack`  | Amber (`--warning`) | In-Game        | Debuff overlay active, glitch effect on tile |
| `eliminated`   | Gray, strikethrough | Spectator View | "ELIMINATED" overlay, then fade to spectator |

### 7.2 Debuff State → UI

| `activeDebuff.type` | UI Effect                                                          | Duration Display      |
| ------------------- | ------------------------------------------------------------------ | --------------------- |
| `ddos`              | Run button disabled, pulsing red border, "BLOCKED" overlay         | Timer on button       |
| `flashbang`         | Entire UI inverts to light mode (white bg, dark text)              | None (just endure)    |
| `vimLock`           | Editor forced to Vim, cyan glow, `[VIM LOCKED]` in status bar      | Timer in status bar   |
| `memoryLeak`        | Stack panel pulses amber, `[MEMORY LEAK]` badge, faster animations | Timer in stack header |
| `null` (no debuff)  | Normal UI                                                          | —                     |

**Debuff Timer Calculation**:

```
remainingMs = new Date(activeDebuff.endsAt) - new Date(serverTime)
```

### 7.3 Buff State → UI

| `activeBuff.type` | UI Effect                                                              |
| ----------------- | ---------------------------------------------------------------------- |
| `rateLimiter`     | `[RATE LIMITER]` badge in status bar, timer showing remaining duration |
| `null` (no buff)  | Normal UI                                                              |

### 7.4 Stack State → UI

| Condition                      | UI Effect                                                       |
| ------------------------------ | --------------------------------------------------------------- |
| `stackSize < STACK_LIMIT - 2`  | Normal stack rendering                                          |
| `stackSize >= STACK_LIMIT - 2` | Panel border pulses red, warning sound                          |
| `stackSize >= STACK_LIMIT - 1` | Faster pulse, urgent warning sound                              |
| `stackSize > STACK_LIMIT`      | Player eliminated (should not render — transition to Spectator) |

**Problem Block Rendering**:
| `problem.isGarbage` | Appearance |
|---------------------|------------|
| `false` | Solid difficulty color bar, normal text |
| `true` | Striped/hatched pattern, dimmed, `[GARBAGE]` label |

**Difficulty → Color**:
| `problem.difficulty` | Color Bar |
|----------------------|-----------|
| `easy` | `--success` (green) |
| `medium` | `--warning` (amber) |
| `hard` | `--danger` (red) |

### 7.5 Match Phase → Screen

| `match.phase` | Screen  | Notes                                  |
| ------------- | ------- | -------------------------------------- |
| `lobby`       | Lobby   | Waiting for host to start              |
| `warmup`      | In-Game | Match running (slower problem cadence) |
| `main`        | In-Game | Match running (normal cadence)         |
| `boss`        | In-Game | Match running (harder problems)        |
| `ended`       | Results | Match complete                         |

### 7.6 Targeting Mode → UI

| `targetingMode` | Minimap Indicator          | Description                    |
| --------------- | -------------------------- | ------------------------------ |
| `random`        | No specific target shown   | Random selection on attack     |
| `attackers`     | Highlight recent attackers | Targets those who attacked you |
| `topScore`      | Highlight #1 score         | Targets leader                 |
| `nearDeath`     | Highlight highest stack    | Targets most vulnerable        |

**Current Target Display**:

- Crosshair or dot overlay on target's minimap tile
- Target may change between attacks (computed at submit time)

### 7.7 Test Results → UI

| `PublicTestResult.passed` | Icon | Color          |
| ------------------------- | ---- | -------------- |
| `true`                    | ✓    | `--success`    |
| `false`                   | ✗    | `--danger`     |
| Not yet run               | ○    | `--text-muted` |

**Judge Result → Feedback**:
| `JudgeResult.passed` | `kind` | UI Response |
|----------------------|--------|-------------|
| `true` | `run` | Tests show ✓, positive sound |
| `false` | `run` | Tests show ✗, error details, error sound |
| `true` | `submit` | +Points, attack sent, advance to next problem, success sound |
| `false` | `submit` | Streak reset, error details, heavier error sound |

### 7.8 Role → UI Permissions

| `role`                | Can Edit Code | Can Run/Submit | Can Shop | Can Chat (Lobby) | Can Spectate |
| --------------------- | ------------- | -------------- | -------- | ---------------- | ------------ |
| `player` (alive)      | ✓             | ✓              | ✓        | ✓                | ✗            |
| `player` (eliminated) | ✗             | ✗              | ✗        | ✓                | ✓            |
| `spectator`           | ✗             | ✗              | ✗        | ✓                | ✓            |
| `bot`                 | —             | —              | —        | —                | —            |

**MVP decision**: chat exists in the Lobby only (no in-match chat to reduce distraction and complexity).

### 7.9 Host Status → UI

| `isHost` | UI Elements                                                                             |
| -------- | --------------------------------------------------------------------------------------- |
| `true`   | Settings dropdowns editable, "Add Bot" button, "Start Match" button, crown icon on tile |
| `false`  | Settings read-only, no host controls, no crown                                          |

**Host Transfer**:

- When host disconnects, server auto-transfers
- UI updates via `ROOM_SNAPSHOT` — new host sees controls, old host (if reconnected) loses them

## 8. Audio Design

### 8.1 Audio Sourcing

**Recommended sources for hackathon:**

| Type               | Source          | Why                                                       |
| ------------------ | --------------- | --------------------------------------------------------- |
| **SFX (UI)**       | BFXR / ChipTone | Instant retro blips, clicks, errors — generate in seconds |
| **SFX (Game)**     | Freesound.org   | Specific sounds (whoosh, impact, explosion) — CC0/CC-BY   |
| **Music**          | Suno AI         | Custom "synthwave hacker game" tracks in minutes          |
| **Music (backup)** | Incompetech     | Ready-made electronic/game music, CC-BY                   |

**Free Libraries:**

- **Freesound.org** — Large community library, search by keyword
- **Pixabay** — Free SFX + music, no attribution required
- **OpenGameArt.org** — Game-specific assets
- **Incompetech** — Kevin MacLeod's library, CC-BY

**AI Generation (fast):**

- **Suno AI / Udio** — Generate custom music from text prompts
- **ElevenLabs Sound Effects** — AI-generated SFX

**DIY Tools:**

- **BFXR** (bfxr.net) — Retro 8-bit SFX generator
- **ChipTone** — More options than BFXR
- **LMMS** — Free DAW for quick music

### 8.2 Ambient / Music

| Context                    | Audio                                | Notes                                              |
| -------------------------- | ------------------------------------ | -------------------------------------------------- |
| **Landing**                | Subtle ambient synth pad, low hum    | Calm lobby atmosphere                              |
| **Lobby**                  | Same ambient, slightly more presence | Waiting, anticipation                              |
| **In-Game (normal)**       | Uptempo electronic/synthwave         | Energetic but not distracting                      |
| **In-Game (danger)**       | Music intensifies                    | Trigger: stack >= STACK_LIMIT - 2, or time < 2 min |
| **In-Game (final minute)** | Peak intensity                       | Faster tempo, more urgency                         |
| **Results (win)**          | Triumphant synth fanfare             | Celebratory                                        |
| **Results (loss)**         | Softer, neutral resolution           | Not punishing, just closure                        |

**Dynamic Music System (stretch goal):**

- Layer tracks that can be mixed based on game state
- Base layer always playing, add intensity layers dynamically

### 8.3 Sound Effects — Player Actions

| Action               | Sound                             | Notes                                       |
| -------------------- | --------------------------------- | ------------------------------------------- |
| **Run (success)**    | Short positive blip               | Quick, satisfying                           |
| **Run (failure)**    | Error buzz/beep                   | Distinct from submit failure                |
| **Submit (success)** | Chime + attack whoosh             | Two-part: personal reward + outgoing attack |
| **Submit (failure)** | Heavier error sound               | More impactful than run failure             |
| **Shop open**        | Mechanical click / drawer open    |                                             |
| **Shop close**       | Softer click                      |                                             |
| **Purchase success** | Confirmation ding / cash register |                                             |
| **Purchase fail**    | Denied buzzer                     | Insufficient score or cooldown              |
| **Vim toggle**       | Mechanical switch click           |                                             |

### 8.4 Sound Effects — Game Events

| Event                        | Sound                         | Notes                         |
| ---------------------------- | ----------------------------- | ----------------------------- |
| **Attack sent**              | Whoosh outward                | Directional feel              |
| **Attack received**          | Impact thud                   | Base sound for all attacks    |
| **DDOS applied**             | Static/interference           | Layered with impact           |
| **Flashbang applied**        | Bright flash/zap              | Jarring, matches visual       |
| **Vim Lock applied**         | Lock click / clunk            | Mechanical                    |
| **Memory Leak applied**      | Alarm / warning siren         | Urgent                        |
| **Garbage Drop received**    | Splat / thunk                 | Something landing             |
| **Debuff cleared**           | Relief chime                  | Positive resolution           |
| **Debuff expired**           | Softer chime                  | Natural end                   |
| **Problem incoming**         | Subtle notification ping      | Not too alarming              |
| **Stack warning (mild)**     | Tension drone                 | When stack >= STACK_LIMIT - 2 |
| **Stack warning (critical)** | Escalating pitch              | When stack >= STACK_LIMIT - 1 |
| **Elimination (others)**     | Distant explosion / crash     | Background event              |
| **Elimination (self)**       | Heavy impact + dramatic sting | Personal, dramatic            |

### 8.5 Sound Effects — Match Flow

| Event                     | Sound                        | Notes                  |
| ------------------------- | ---------------------------- | ---------------------- |
| **Match start countdown** | Beeps (3, 2, 1)              | Building anticipation  |
| **Match start**           | Horn / starting gun          | Clear signal           |
| **Phase change**          | Subtle transition tone       | warmup → main → boss   |
| **Final minute warning**  | Alert tone                   | "One minute remaining" |
| **Match end**             | Final horn / gong            | Definitive ending      |
| **Winner reveal**         | Fanfare / triumphant stinger | Podium moment          |

### 8.6 Sound Effects — UI

| Interaction               | Sound                | Notes                         |
| ------------------------- | -------------------- | ----------------------------- |
| **Button hover**          | Subtle tick          | Optional, can be silent       |
| **Button click**          | Mechanical click     | Consistent across all buttons |
| **Chat message sent**     | Soft blip            |                               |
| **Chat message received** | Softer blip          | Distinct from sent            |
| **Player joined (lobby)** | Notification chime   |                               |
| **Player left (lobby)**   | Softer notification  |                               |
| **Error toast**           | Error ping           |                               |
| **Success toast**         | Success ping         |                               |
| **Copy to clipboard**     | Click / confirmation |                               |

### 8.7 Audio Settings

Players should be able to control:

- **Master volume**: 0-100%
- **Music volume**: 0-100%
- **SFX volume**: 0-100%
- **Mute all**: Quick toggle

Store preferences in localStorage. Default: all at 70%.

### 8.8 Browser Autoplay / Audio Unlock

Modern browsers (Chrome/Firefox) commonly block audio playback until a **user gesture** (click/keypress).

- Treat any "audio on load" behavior as **"audio after first gesture"**.
- On first gesture, unlock audio (resume Web Audio context) and fade in music over ~200–500ms.
- If audio is blocked, show a small indicator on Landing/Lobby: `Audio: Off (press any key to enable)`.
- Provide a quick mute toggle (recommended): `Alt/Option+M`.

## 9. Open Questions

Decisions deferred for implementation or future discussion:

### 9.1 Keybinds & Input

- **Vim keybind audit**: Need to fully map Vim keybinds vs game keybinds to avoid conflicts. Current plan uses `Alt/Option+…` combos for global game actions (avoid browser-reserved `Ctrl+R` / `Ctrl+S`), but needs testing.
- **Keybind customization**: Should players be able to rebind keys? (Probably not for MVP)

### 9.2 Tutorial

- **Mock game state**: Interactive tutorial needs fake game state (problems, stack, etc.). How much to preload vs generate?
- **Tutorial replay**: Can players replay tutorial mid-match if confused? Probably not — just link to "How to Play" from pause/menu.

### 9.3 Chat & Social

- **Spectator chat permissions**: MVP decision is lobby-only chat. Spectators/eliminated players can chat in Lobby.
- **Chat during match**: Post-MVP decision — keeping in-game chat off for MVP reduces distraction and complexity.

### 9.4 Bots & Spectating

- **Spectating bots**: When spectating a bot, what do we show for code? Options:
  - Placeholder text ("Bot is thinking...")
  - Skip bots in spectate rotation
  - Show fake/random code (confusing?)
- **Bot difficulty visible**: Should spectators see bot difficulty labels?

### 9.5 Reconnection

- **Reconnection UX**: What happens visually when you disconnect and reconnect mid-match?
  - Show "Reconnecting..." overlay?
  - Flash "Reconnected" toast?
  - How long until considered "abandoned"?

### 9.6 Audio & Licensing

- **License verification**: If using Freesound/Incompetech assets, verify license compliance before public release.
- **AI-generated music rights**: Check Suno/Udio terms for commercial/public use.

### 9.7 Accessibility

- **Flashbang alternative**: Should there be a reduced-motion or reduced-intensity option for photosensitive players?
- **Color-blind modes**: Current palette relies on red/green/amber — may need alternative indicators (icons, patterns).
- **Screen reader support**: Not prioritized for MVP, but worth noting for future.

### 9.8 Scalability

- **Responsive roster density (Lobby + in-game HUD)**:
  - **2–12 players**: card roster (full name, role badge, status, stack bar, score).
  - **13–36 players**: compact list (name, status color, stack bar, score).
  - **37–99 players**: dense 11×9 grid (initials/icon only); hover/selection reveals name + status + stack + score.
  - Sticky header with `Players (x/99)` and quick filters: All / Alive / Bots / Spectators.
- **Minimap scaling + information budget**:
  - Minimap footprint fixed on desktop; tiles change density.
  - **≤16 players**: large tiles (status + stack bar + score microtext).
  - **17–49 players**: medium tiles (status + stack bar + score dot).
  - **50–99 players**: micro tiles (status + stack bar).
  - Tile encoding: status color, stack pressure bar (0–10), score hint, target ring; 1–2px debuff glyph.
- **Minimap density sketch (not to scale)**:
  ```text
  ≤16 players (large)     17–49 players (medium)    50–99 players (micro)
  [AL|####] [BZ|### ]     [A|###] [B|## ]           [A|#][B|#][C|#][D|#]
  [CY|##  ] [DK|#####]    [C|## ] [D|###]           [E|#][F|#][G|#][H|#]
  ```
- **Progressive disclosure**:
  - Hover/selection reveals tooltip: name, status, stack size, score, streak, debuff.
  - Clicking a tile pins a focus panel in sidebar (stack timeline sparkline + last submit result).
- **Spectator minimap modes (future)**:
  - Global view (default): full-width minimap replaces editor; larger tiles allow stack bar + score + streak microtext + debuff glyphs.
  - Player view: zoom into a single player (Tetris 99 style) with their editor + stack panel; minimap collapses to side.
  - Spectator toggles Global ↔ Player via click or hotkey (`Tab`).
- **Design note**: avoid full stack content previews for all players; emphasize pressure + status at a glance.
- **Performance with many players**: Terminal log, minimap updates, WebSocket traffic — needs stress testing.

---

## Appendix A: Vertical Slice Implementation Checklist

This checklist is ordered to get a playable end-to-end slice fast, then deepen fidelity.

### A.1 Milestones (recommended build order)

| Milestone                           | Goal                                                           | Acceptance                                                                                         |
| ----------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **M0: Theme + primitives**          | Establish the riced workstation look as reusable tokens        | Palette + typography applied; `Button`, `Input`, `Panel`, `Tile` look correct                      |
| **M1: Routing + screen shells**     | All screens exist as navigable routes with placeholder content | Landing → Create → Lobby; Landing → Join → Lobby; Results/Spectator routes render                  |
| **M2: API wiring (create/join)**    | Can create/join rooms via HTTP and connect to WS               | `POST /api/rooms` + `POST /api/rooms/:roomId/join` work; token stored; connects to `wsUrl`         |
| **M3: Lobby realtime**              | Lobby roster + settings + bots + lobby chat                    | Player tiles update; host controls gated; chat works; copy link works                              |
| **M4: In-Game UI (mock state)**     | Core in-game layout works without backend game engine          | Editor + problem panel + stack + minimap + terminal log render from mocked state                   |
| **M5: Realtime snapshot rendering** | In-Game drives from `ROOM_SNAPSHOT` + deltas                   | UI updates on snapshot; stack/minimap/log update without refresh                                   |
| **M6: Run/Submit feedback loop**    | One problem can be run/submitted and shows results             | Run updates public tests; Submit updates score/streak + terminal log; advance problem on pass      |
| **M7: Shop + debuffs**              | Shop purchases and debuff visuals are coherent                 | `SPEND_POINTS` works; DDOS disables run; Flashbang inverts; VimLock forces vim; MemoryLeak warning |
| **M8: End-to-end match**            | Full match flow including results + return to lobby            | `MATCH_END` → Results renders; Return to Lobby works                                               |
| **M9: Spectator**                   | Eliminated/spectators can watch others                         | Spectator view read-only; `Tab` cycles; minimap click switches                                     |
| **M10: Tutorial + audio polish**    | First-time flow and game feel upgrades                         | Tutorial runs; audio unlock works; key SFX present; music swaps by state                           |

### A.2 "Must Build First" Component Stack

1. **Design tokens** (Tailwind / CSS vars): colors, typography, borders, spacing
2. **Primitives**: `Button`, `Input`, `Dropdown`, `Panel`, `Tile`
3. **App shell**: layout grid + routing between screens
4. **In-game core**: Monaco wrapper + ProblemDisplay + StackPanel + Minimap + TerminalLog + ActionBar
5. **Hotkey system**: `Alt/Option+…` bindings + focus rules (modal/input/editor)
6. **Networking glue**: HTTP create/join + WS connect + store/reducer for `ROOM_SNAPSHOT`

### A.3 Integration Checklist (backend alignment)

- **Room join/create**
  - `roomId` is the short code like `AB12CD`
  - Persist `{ roomId, wsUrl, playerToken }` in localStorage for reconnect
- **Shop**
  - Render catalog from `RoomSnapshot.shopCatalog` (server is source of truth)
  - `SPEND_POINTS` uses `ShopItem` ids exactly
- **Timers**
  - Debuff timers computed from `serverTime` + `endsAt` (avoid client clock drift)

### A.4 Vertical Slice Demo Script (dev verification)

1. Create a room (host) → add 2 bots → start match
2. In-Game: run tests → submit success → see score + terminal log
3. Trigger a debuff (or simulate) → verify visual + input change
4. Open shop → buy `clearDebuff` (or see failure handling)
5. End match (or simulate `MATCH_END`) → Results screen → Return to Lobby
