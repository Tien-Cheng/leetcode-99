import test from "node:test";
import assert from "node:assert/strict";

type PartyRegisterRequest = {
  playerId: string;
  playerToken: string;
  username: string;
  role: "player" | "spectator";
  isHost: boolean;
  settings?: {
    playerCap?: number;
  };
};

import { applyPartyRegister, createEmptyRoomState } from "../src/register.ts";

function makeReq(
  overrides: Partial<PartyRegisterRequest>,
): PartyRegisterRequest {
  return {
    playerId: "p_1",
    playerToken: "t_1",
    username: "Alice",
    role: "player",
    isHost: false,
    settings: undefined,
    ...overrides,
  };
}

test("join before created => ROOM_NOT_FOUND", () => {
  const state = createEmptyRoomState("room_1");

  const res = applyPartyRegister(state, makeReq({ isHost: false }));

  assert.equal(res.ok, false);
  assert.equal(res.error.code, "ROOM_NOT_FOUND");
});

test("create marks room created and applies settings", () => {
  const state = createEmptyRoomState("room_1");

  const res = applyPartyRegister(
    state,
    makeReq({ isHost: true, settings: { playerCap: 3 } }),
  );

  assert.equal(res.ok, true);
  assert.equal(state.isCreated, true);
  assert.equal(state.settings.playerCap, 3);
  assert.equal(res.response.phase, "lobby");
  assert.deepEqual(res.response.counts, { players: 1, spectators: 0 });
});

test("username must be case-insensitively unique", () => {
  const state = createEmptyRoomState("room_1");
  applyPartyRegister(state, makeReq({ isHost: true, username: "Alice" }));

  const res = applyPartyRegister(
    state,
    makeReq({ playerId: "p_2", playerToken: "t_2", username: "alice" }),
  );

  assert.equal(res.ok, false);
  assert.equal(res.error.code, "USERNAME_TAKEN");
});

test("username must be unique across roles (case-insensitive)", () => {
  const state = createEmptyRoomState("room_1");
  applyPartyRegister(state, makeReq({ isHost: true, username: "Alice" }));

  const res = applyPartyRegister(
    state,
    makeReq({
      playerId: "s_1",
      playerToken: "st_1",
      username: "ALICE",
      role: "spectator",
    }),
  );

  assert.equal(res.ok, false);
  assert.equal(res.error.code, "USERNAME_TAKEN");
});

test("role=player blocked after phase != lobby", () => {
  const state = createEmptyRoomState("room_1");
  applyPartyRegister(state, makeReq({ isHost: true }));
  state.match.phase = "main";

  const res = applyPartyRegister(
    state,
    makeReq({ playerId: "p_2", playerToken: "t_2", username: "Bob" }),
  );

  assert.equal(res.ok, false);
  assert.equal(res.error.code, "MATCH_ALREADY_STARTED");
});

test("role=spectator allowed after phase != lobby", () => {
  const state = createEmptyRoomState("room_1");
  applyPartyRegister(state, makeReq({ isHost: true }));
  state.match.phase = "main";

  const res = applyPartyRegister(
    state,
    makeReq({
      playerId: "s_1",
      playerToken: "st_1",
      username: "Spectator",
      role: "spectator",
    }),
  );

  assert.equal(res.ok, true);
  assert.equal(res.response.phase, "main");
  assert.deepEqual(res.response.counts, { players: 1, spectators: 1 });
});

test("playerCap enforced for human players only", () => {
  const state = createEmptyRoomState("room_1");
  applyPartyRegister(
    state,
    makeReq({ isHost: true, settings: { playerCap: 2 } }),
  );

  // Second player ok
  {
    const res = applyPartyRegister(
      state,
      makeReq({ playerId: "p_2", playerToken: "t_2", username: "Bob" }),
    );
    assert.equal(res.ok, true);
    assert.deepEqual(res.response.counts, { players: 2, spectators: 0 });
  }

  // Spectator does not count
  {
    const res = applyPartyRegister(
      state,
      makeReq({
        playerId: "s_1",
        playerToken: "st_1",
        username: "Spec",
        role: "spectator",
      }),
    );
    assert.equal(res.ok, true);
    assert.deepEqual(res.response.counts, { players: 2, spectators: 1 });
  }

  // Third player rejected
  {
    const res = applyPartyRegister(
      state,
      makeReq({ playerId: "p_3", playerToken: "t_3", username: "Cara" }),
    );
    assert.equal(res.ok, false);
    assert.equal(res.error.code, "ROOM_FULL");
  }
});
