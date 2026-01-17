import test from "node:test";
import assert from "node:assert/strict";

import {
  HttpErrorResponseSchema,
  PartyRegisterResponseSchema,
} from "@leet99/contracts";
import Room from "../src/room.ts";

class MemoryStorage {
  private store = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | undefined> {
    return this.store.get(key) as T | undefined;
  }

  async put(key: string, value: unknown): Promise<void> {
    this.store.set(key, value);
  }
}

function makeRoomServer(roomId = "room_1") {
  const room = {
    id: roomId,
    storage: new MemoryStorage(),
    getConnections: () => [],
  };

  // Room expects a Party.Room, but only uses id/storage/getConnections.
  return new Room(room as never);
}

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  return JSON.parse(text) as T;
}

test("/register invalid payload => 400 BAD_REQUEST", async () => {
  const server = makeRoomServer();

  const req = new Request(
    "https://example.com/parties/leet99/room_1/register",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    },
  );

  const res = await server.onRequest(req as never);
  const body = await readJson<unknown>(res);
  const parsed = HttpErrorResponseSchema.parse(body);

  assert.equal(res.status, 400);
  assert.equal(parsed.error.code, "BAD_REQUEST");
  assert.ok(parsed.error.message.length > 0);
  assert.ok(parsed.error.details);
});

test("/register join before created => 404 ROOM_NOT_FOUND", async () => {
  const server = makeRoomServer();

  const req = new Request(
    "https://example.com/parties/leet99/room_1/register",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        playerId: "p_1",
        playerToken: "t_1",
        username: "Alice",
        role: "player",
        isHost: false,
      }),
    },
  );

  const res = await server.onRequest(req as never);
  const body = await readJson<unknown>(res);
  const parsed = HttpErrorResponseSchema.parse(body);

  assert.equal(res.status, 404);
  assert.equal(parsed.error.code, "ROOM_NOT_FOUND");
  assert.ok(parsed.error.message.length > 0);
});

test("/register match already started => 409 MATCH_ALREADY_STARTED", async () => {
  const server = makeRoomServer();

  // Create host
  {
    const req = new Request(
      "https://example.com/parties/leet99/room_1/register",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          playerId: "p_1",
          playerToken: "t_1",
          username: "Host",
          role: "player",
          isHost: true,
        }),
      },
    );
    const res = await server.onRequest(req as never);
    assert.equal(res.status, 200);
  }

  // Force match started
  (
    server as unknown as { state: { match: { phase: string } } }
  ).state.match.phase = "warmup";

  // Player join
  const joinReq = new Request(
    "https://example.com/parties/leet99/room_1/register",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        playerId: "p_2",
        playerToken: "t_2",
        username: "Bob",
        role: "player",
        isHost: false,
      }),
    },
  );

  const joinRes = await server.onRequest(joinReq as never);
  const body = await readJson<unknown>(joinRes);
  const parsed = HttpErrorResponseSchema.parse(body);

  assert.equal(joinRes.status, 409);
  assert.equal(parsed.error.code, "MATCH_ALREADY_STARTED");
  assert.ok(parsed.error.message.length > 0);
});

test("/register username taken => 409 USERNAME_TAKEN", async () => {
  const server = makeRoomServer();

  // Create host
  {
    const req = new Request(
      "https://example.com/parties/leet99/room_1/register",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          playerId: "p_1",
          playerToken: "t_1",
          username: "Alice",
          role: "player",
          isHost: true,
        }),
      },
    );
    const res = await server.onRequest(req as never);
    assert.equal(res.status, 200);
  }

  const joinReq = new Request(
    "https://example.com/parties/leet99/room_1/register",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        playerId: "p_2",
        playerToken: "t_2",
        username: "alice",
        role: "player",
        isHost: false,
      }),
    },
  );

  const joinRes = await server.onRequest(joinReq as never);
  const body = await readJson<unknown>(joinRes);
  const parsed = HttpErrorResponseSchema.parse(body);

  assert.equal(joinRes.status, 409);
  assert.equal(parsed.error.code, "USERNAME_TAKEN");
  assert.ok(parsed.error.message.length > 0);
});

test("/register success => 200 parses PartyRegisterResponseSchema", async () => {
  const roomId = "room_1";
  const server = makeRoomServer(roomId);

  const req = new Request(
    `https://example.com/parties/leet99/${roomId}/register`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        playerId: "p_1",
        playerToken: "t_1",
        username: "Host",
        role: "player",
        isHost: true,
      }),
    },
  );

  const res = await server.onRequest(req as never);
  const body = await readJson<unknown>(res);

  assert.equal(res.status, 200);

  const parsed = PartyRegisterResponseSchema.parse(body);

  assert.equal(parsed.roomId, roomId);
  assert.equal(parsed.phase, "lobby");
  assert.equal(parsed.counts.players, 1);
  assert.equal(parsed.counts.spectators, 0);
});
