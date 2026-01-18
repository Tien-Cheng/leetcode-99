# Leet 99

> **Battle Royale for Coders** — Tetris 99 meets programming in a fast-paced multiplayer coding game.

<p align="center">
  <img src="https://img.shields.io/badge/status-hackathon-blueviolet" alt="Status">
  <img src="https://img.shields.io/badge/players-2--99-cyan" alt="Players">
  <img src="https://img.shields.io/badge/language-Python-yellow" alt="Python">
</p>

---

## 🚀 Overview

Leet 99 is a real-time multiplayer battle royale game where players race to solve bite-sized tech interview-style problems. Unsolved problems stack up — if your stack overflows, you're eliminated. Solve problems to score points and attack your opponents with devious debuffs. **Last coder standing wins!**

### ✨ Key Features

- **2-99 Players** — Join rooms with friends or compete against bots
- **Real-time Combat** — Attacks, debuffs, and garbage problems keep everyone on edge
- **Stack Overflow Mechanic** — Problems pile up; overflow = elimination
- **Tetris 99-style Targeting** — Choose your targeting mode: Random, Attackers, Top Score, or Near Death
- **Function-only Python Problems** — Quick to read, fast to solve (1-5 minutes each)

---

## 🎯 Gameplay

### The Loop

```
Read problem → Write code → Run (test) → Submit → Attack! → Next problem
```

1. **Start** with 1 active problem + 2 queued problems in your stack
2. **Solve** problems to earn points and automatically attack your target
3. **New problems** arrive periodically — they push onto your stack
4. **Stack overflow?** You're eliminated!
5. **Last player standing** wins (or highest score when time expires)

### Scoring

| Difficulty | Points |
| ---------- | ------ |
| Easy       | +5     |
| Medium     | +10    |
| Hard       | +20    |
| Garbage    | 0      |

### Attacks & Debuffs

When you solve a problem, you attack your current target:

| Attack              | Effect                                  | Trigger            |
| ------------------- | --------------------------------------- | ------------------ |
| 🗑️ **Garbage Drop** | Add 1 garbage problem to target's stack | Solving **Easy**   |
| 💡 **Flashbang**    | Force light mode for 25s                | Solving **Medium** |
| ⌨️ **Vim Lock**     | Force Vim mode for 12s                  | Solving **Medium** |
| 🚫 **DDOS**         | Disable "Run" for 12s                   | Solving **Hard**   |
| 💾 **Memory Leak**  | Double incoming problem rate for 30s    | 3-solve streak     |

### Shop Items

Spend your hard-earned points to gain an edge:

| Item          | Cost | Effect                              |
| ------------- | ---- | ----------------------------------- |
| Clear Debuff  | 10   | Remove active debuff                |
| Memory Defrag | 10   | Remove all garbage from stack       |
| Skip Problem  | 15   | Discard current problem             |
| Rate Limiter  | 10   | Halve incoming problem rate for 30s |
| Hint          | 5    | Reveal a hint for current problem   |

---

## 🏗️ Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Browser   │────▶│   Next.js   │────▶│  Supabase   │
│   (Client)  │     │   (Vercel)  │     │  (Postgres) │
└──────┬──────┘     └─────────────┘     └─────────────┘
       │
       │ WebSocket
       ▼
┌─────────────┐     ┌─────────────┐
│  PartyKit   │────▶│  Judge0 CE  │
│   (Room)    │     │ (RapidAPI)  │
└─────────────┘     └─────────────┘
```

### Tech Stack

| Layer              | Technology                                   |
| ------------------ | -------------------------------------------- |
| **Frontend**       | Next.js, Tailwind CSS, daisyUI, Lucide Icons |
| **Editor**         | Monaco + monaco-vim                          |
| **Realtime**       | PartyKit (WebSocket rooms)                   |
| **Persistence**    | Supabase (PostgreSQL)                        |
| **Code Execution** | Judge0 CE via RapidAPI                       |
| **Deploy**         | Vercel + PartyKit Cloud                      |

### Project Structure

```
Leet-99/
├── apps/
│   └── web/              # Next.js frontend application
├── packages/
│   ├── contracts/        # Shared TypeScript types & Zod schemas
│   ├── realtime/         # PartyKit room logic (game engine)
│   ├── supabase/         # Database queries & types
│   └── ui/               # Shared React components
├── docs/                 # Design documents & specs
└── supabase/             # Database migrations
```

---

## 🎨 Design Philosophy

**"Riced Workstation" Aesthetic** — Inspired by r/unixporn tiling WM setups:

- Dark theme (harsh white "Flashbang" for the debuff 😈)
- Sharp edges, minimal border-radius
- Dense but readable information layout
- IBM Plex fonts (Sans + Mono)
- Subtle noise grain texture

### What We Avoid

- ❌ Purple gradients on white (AI-generated startup slop)
- ❌ Rounded-everything soft UI
- ❌ Default SaaS fonts
- ❌ Empty decorative space

---

## 🕹️ Controls

### Keyboard Shortcuts

| Key     | Action                  |
| ------- | ----------------------- |
| `Alt+R` | Run code (public tests) |
| `Alt+S` | Submit code             |
| `Alt+B` | Open/close shop         |
| `Alt+T` | Targeting mode menu     |
| `Alt+V` | Toggle Vim mode         |
| `1-5`   | Quick-buy shop items    |
| `Esc`   | Close menus             |

---

## 🔌 API Overview

### HTTP Endpoints

| Method | Endpoint                  | Description            |
| ------ | ------------------------- | ---------------------- |
| `POST` | `/api/rooms`              | Create a new room      |
| `POST` | `/api/rooms/:roomId/join` | Join an existing room  |
| `GET`  | `/api/rooms/:roomId`      | Get room summary       |
| `GET`  | `/api/matches/:matchId`   | Get match results      |
| `GET`  | `/api/leaderboard`        | Get global leaderboard |

### WebSocket Events

**Client → Server:**

- `JOIN_ROOM` — Authenticate and join
- `SET_TARGET_MODE` — Change targeting mode
- `RUN_CODE` — Run public tests
- `SUBMIT_CODE` — Submit for scoring
- `SPEND_POINTS` — Purchase shop item
- `SPECTATE_PLAYER` — Watch another player

**Server → Client:**

- `ROOM_SNAPSHOT` — Full state sync
- `PLAYER_UPDATE` — Player state change
- `JUDGE_RESULT` — Code execution result
- `ATTACK_RECEIVED` — Incoming attack
- `MATCH_END` — Game over + standings

---

## 🚦 Getting Started

### Prerequisites

- Node.js 20+
- pnpm 8+
- RapidAPI account (for Judge0)
- Supabase project
- PartyKit account

### Environment Variables

Copy `.env.example` to `.env.local` and configure:

```bash
# PartyKit
NEXT_PUBLIC_PARTYKIT_HOST=your-project.partykit.dev

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key

# Judge0 (RapidAPI)
RAPIDAPI_KEY=your-rapidapi-key
RAPIDAPI_HOST=judge0-ce.p.rapidapi.com
```

### Installation

```bash
# Install dependencies
pnpm install

# Start development servers
pnpm dev
```

### Deploy

```bash
# Deploy PartyKit
npx partykit deploy

# Deploy to Vercel
vercel deploy
```

---

## 🤖 Bots

Sim bots keep lobbies lively for demos:

- **Solve Time**: Easy 30-60s, Medium 45-90s, Hard 60-120s
- **Failure Rate**: ~20% of submissions fail
- **Targeting**: Always random
- **Shop**: Never buys items

Bots participate fully in scoring, stacks, and elimination.

---

## ⚙️ Room Settings

| Setting          | Default  | Options                           |
| ---------------- | -------- | --------------------------------- |
| Match Duration   | 10 min   | 6-10 minutes                      |
| Player Cap       | 8        | 2-99                              |
| Stack Limit      | 10       | —                                 |
| Difficulty       | Moderate | Beginner / Moderate / Competitive |
| Attack Intensity | Low      | Low / High (1.3x debuff duration) |

---

## 📚 Documentation

- [Design Document](./docs/Design%20Document.md) — Full game design spec
- [Frontend UI Spec](./docs/Frontend%20UI%20Spec.md) — UI/UX guidelines and layouts
- [Backend API Spec](./docs/Backend%20API%20Spec.md) — Complete API reference

---

## 🏆 MVP Definition of Done

- ✅ Players can create/join rooms via URL
- ✅ 2+ players see each other in minimap with synced game state
- ✅ Problems push onto stack; `RUN_CODE` tests public, `SUBMIT_CODE` tests all
- ✅ Correct submissions award points, advance problems, send attacks
- ✅ Stack overflow eliminates players
- ✅ Winner determined: last alive or highest score
- ✅ Bots fill lobbies for demos
- ✅ Deployed publicly

---

## 📝 License

This project is licensed under the [AGPL-3.0](./LICENSE) license.

---

<p align="center">
  <strong>May the best coder survive! 🧑‍💻⚔️</strong>
</p>
