# Backend API Spec Implementation Review

**Date:** 2026-01-17  
**Status:** Most features implemented, but **critical persistence missing**

## Summary

The Backend API Spec is **mostly implemented**, with all HTTP endpoints, WebSocket events, and game mechanics in place. However, **match persistence to Supabase is missing** - matches are only saved to PartyKit storage, not to the database. This means leaderboards and match history won't work properly.

## ✅ Implemented Features

### 1. HTTP API Endpoints (Section 7)

All required endpoints are implemented:

- ✅ `POST /api/rooms` - Create room and join as host
- ✅ `POST /api/rooms/:roomId/join` - Join room as player/spectator
- ✅ `GET /api/rooms/:roomId` - Get room summary
- ✅ `GET /api/matches/:matchId` - Get match results
- ✅ `GET /api/rooms/:roomId/matches` - Room match history
- ✅ `GET /api/leaderboard` - Global leaderboard

All endpoints follow the spec's request/response shapes and error handling.

### 2. WebSocket Client → Server Events (Section 8.2)

All client message types are handled:

- ✅ `JOIN_ROOM` - Connect and authenticate
- ✅ `SET_TARGET_MODE` - Set targeting mode
- ✅ `UPDATE_SETTINGS` - Host-only, lobby-only settings update
- ✅ `START_MATCH` - Host-only, lobby-only match start
- ✅ `RETURN_TO_LOBBY` - Host-only, ended-only reset
- ✅ `ADD_BOTS` - Host-only, lobby-only bot addition
- ✅ `SEND_CHAT` - Lobby chat messages
- ✅ `RUN_CODE` - Run code against public tests
- ✅ `SUBMIT_CODE` - Submit code for judging
- ✅ `SPEND_POINTS` - Shop purchases
- ✅ `SPECTATE_PLAYER` - Start spectating
- ✅ `STOP_SPECTATE` - Stop spectating
- ✅ `CODE_UPDATE` - Editor code streaming

### 3. WebSocket Server → Client Events (Section 8.3)

All server message types are sent:

- ✅ `ROOM_SNAPSHOT` - Full room state (on join/resync)
- ✅ `SETTINGS_UPDATE` - Settings changed
- ✅ `MATCH_STARTED` - Match phase transition to warmup
- ✅ `MATCH_PHASE_UPDATE` - Phase transitions (warmup → main)
- ✅ `PLAYER_UPDATE` - Player public state changes
- ✅ `JUDGE_RESULT` - Code execution results
- ✅ `STACK_UPDATE` - Player stack size changes
- ✅ `CHAT_APPEND` - New chat message
- ✅ `ATTACK_RECEIVED` - Attack notifications
- ✅ `EVENT_LOG_APPEND` - Event log entries
- ✅ `SPECTATE_STATE` - Spectating state updates
- ✅ `CODE_UPDATE` (relayed) - Code updates to spectators
- ✅ `MATCH_END` - Match completion
- ✅ `ERROR` - Error responses

### 4. Rate Limiting (Section 6)

Rate limits are implemented per spec:

- ✅ `RUN_CODE`: 1 per 2 seconds
- ✅ `SUBMIT_CODE`: 1 per 3 seconds
- ✅ `CODE_UPDATE`: 10 per second, 50KB max
- ✅ `SPECTATE_PLAYER`: 1 per second
- ✅ `SEND_CHAT`: 2 per second, 200 chars max

### 5. Game Mechanics

#### Scoring & Streaks (Section 8.2)
- ✅ Points: easy +5, medium +10, hard +20
- ✅ Streak increments on pass, resets on fail
- ✅ Garbage problems: 0 points, no streak, no attack

#### Attacks & Debuffs (Section 8.6)
- ✅ Attack types: `ddos`, `flashbang`, `vimLock`, `memoryLeak`, `garbageDrop`
- ✅ Durations: 12s (ddos/vimLock), 25s (flashbang), 30s (memoryLeak)
- ✅ Attack intensity scaling (1.3x for "high")
- ✅ Debuff grace period (5s immunity)
- ✅ Max 1 concurrent timed debuff

#### Targeting (Section 8.4)
- ✅ `random` - Uniform random
- ✅ `attackers` - Recent attackers (20s window)
- ✅ `topScore` - Highest score
- ✅ `nearDeath` - Highest stackSize/stackLimit ratio

#### Problems & Stack (Section 8.5)
- ✅ Problem assignment on match start
- ✅ Timed problem arrivals (warmup: 90s, main: 60s)
- ✅ Rate limiter buff (2x interval)
- ✅ Memory leak debuff (0.5x interval)
- ✅ Stack overflow elimination
- ✅ Problem history tracking (avoid repeats)

#### Shop Items (Section 8.2)
- ✅ `clearDebuff` - Remove active debuff
- ✅ `memoryDefrag` - Remove garbage from queue
- ✅ `skipProblem` - Skip current problem
- ✅ `rateLimiter` - 30s buff, 60s cooldown
- ✅ `hint` - Reveal hint line

#### Bots (Section 8.7)
- ✅ Bot simulation with solve times
- ✅ 20% failure rate
- ✅ Random targeting
- ✅ No shop purchases

#### Host Transfer (Section 3.2)
- ✅ Auto-transfer on disconnect
- ✅ Earliest join order selection
- ✅ Null host when no players

### 6. Database Schema (Section 9.1)

Tables are created:

- ✅ `matches` table with all required fields
- ✅ `match_players` table with all required fields
- ✅ Proper indexes for queries
- ✅ RLS policies

### 7. Read Queries (Section 9)

Read operations are implemented:

- ✅ `getMatchResults()` - Fetch match by ID
- ✅ `getLeaderboard()` - Global leaderboard
- ✅ `getRoomMatches()` - Room match history

## ❌ Missing Features

### 1. Match Persistence to Supabase (Section 9.2) - **CRITICAL**

**Status:** Not implemented

**Issue:** The spec requires that "PartyKit server writes one `matches` row + many `match_players` rows when the match ends." However:

- `persistState()` only saves to PartyKit storage (`this.room.storage.put()`)
- No function exists to write to Supabase
- `packages/supabase/src/queries.ts` only has read functions, no write functions

**Impact:**
- Leaderboards will be empty (no data to read)
- Match history will be empty
- `GET /api/matches/:matchId` will return 404 for all matches
- End-of-game screens can't fetch match results

**Required Implementation:**
1. Create `saveMatch()` function in `packages/supabase/src/queries.ts`:
   ```ts
   export async function saveMatch(
     matchId: string,
     roomId: string,
     startAt: string,
     endAt: string,
     endReason: "lastAlive" | "timeExpired",
     settings: RoomSettings,
     standings: StandingEntry[]
   ): Promise<{ ok: true } | { ok: false; error: Error }>
   ```

2. Call `saveMatch()` in `endMatch()` method in `packages/realtime/src/room.ts`:
   ```ts
   private async endMatch(endReason: MatchEndReason) {
     // ... existing code ...
     
     // Persist to Supabase
     const saveResult = await saveMatch(
       this.state.match.matchId!,
       this.state.roomId,
       this.state.match.startAt!,
       this.state.match.endAt!,
       endReason,
       this.state.match.settings,
       standings
     );
     
     if (!saveResult.ok) {
       console.error(`[${this.state.roomId}] Failed to persist match:`, saveResult.error);
       // Continue anyway - match end is broadcast
     }
     
     // ... rest of existing code ...
   }
   ```

3. Need to track `eliminated_at` timestamps for each player in standings

### 2. Minor Issues

#### Username Validation
- Spec says case-insensitive uniqueness check
- Implementation uses `normalizeUsername()` which lowercases - ✅ likely correct, but should verify

#### Judge0 Integration
- Spec mentions RapidAPI integration with `X-RapidAPI-Key` headers
- Implementation appears to use direct Judge0 (see `packages/judge/src/index.ts`)
- May need to verify if this matches production requirements

#### Problem Arrival Timing
- Spec says "warmup: every 90s, main: every 60s"
- Implementation uses per-player timing with effective intervals
- Should verify this matches spec intent

## 📋 Verification Checklist

To fully verify implementation:

- [ ] Test all HTTP endpoints with valid/invalid inputs
- [ ] Test all WebSocket events with valid/invalid payloads
- [ ] Test rate limiting enforcement
- [ ] Test host transfer on disconnect
- [ ] Test match end conditions (time expired, last alive)
- [ ] **Test match persistence to Supabase** (currently missing)
- [ ] Test leaderboard queries (will fail without persistence)
- [ ] Test match history queries (will fail without persistence)
- [ ] Test bot behavior matches spec
- [ ] Test all shop items
- [ ] Test all attack types and durations
- [ ] Test spectating permissions
- [ ] Test elimination on stack overflow

## Recommendations

1. **URGENT:** Implement match persistence to Supabase (Section 9.2)
2. Add error handling/logging for Supabase write failures
3. Consider adding retry logic for Supabase writes
4. Add integration tests for match persistence
5. Verify Judge0 integration matches production requirements
6. Document any deviations from spec (e.g., per-player problem timing)

## Conclusion

The implementation is **~95% complete**. The only critical missing piece is match persistence to Supabase, which prevents leaderboards and match history from working. All other features appear to be implemented according to the spec.
