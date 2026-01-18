import { NextRequest, NextResponse } from "next/server";
import {
  JoinRoomRequestSchema,
  type JoinRoomResponse,
  type HttpErrorResponse,
} from "@leet99/contracts";
import { registerPartyPlayer, toWsUrl } from "@/server/partykit";

type RouteParams = {
  params: Promise<{ roomId: string }>;
};

/**
 * POST /api/rooms/:roomId/join - Join an existing room
 *
 * Joins a room as player (lobby only) or spectator (any time).
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  let roomId: string | undefined;

  try {
    ({ roomId } = await params);
    const body = await req.json();
    const parsed = JoinRoomRequestSchema.safeParse(body);

    if (!parsed.success) {
      const error: HttpErrorResponse = {
        error: {
          code: "BAD_REQUEST",
          message: "Invalid request body",
          details: parsed.error.flatten(),
        },
      };
      return NextResponse.json(error, { status: 400 });
    }

    const { username } = parsed.data;
    const role = parsed.data.role ?? "player";
    const allowLateJoin = parsed.data.allowLateJoin;

    // Validate username
    const trimmedUsername = username.trim();
    if (trimmedUsername.length < 1 || trimmedUsername.length > 16) {
      const error: HttpErrorResponse = {
        error: {
          code: "BAD_REQUEST",
          message: "Username must be 1-16 characters",
        },
      };
      return NextResponse.json(error, { status: 400 });
    }

    // Generate player credentials
    const playerId = `p_${crypto.randomUUID()}`;
    const playerToken = `pt_${crypto.randomUUID()}`;

    const registerResult = await registerPartyPlayer(roomId, {
      playerId,
      playerToken,
      username: trimmedUsername,
      role,
      isHost: false,
      allowLateJoin,
    });

    if (!registerResult.ok) {
      console.error("Failed to register player with PartyKit", {
        roomId,
        status: registerResult.status,
      });

      return NextResponse.json(registerResult.error, {
        status: registerResult.status,
      });
    }

    const response: JoinRoomResponse = {
      roomId,
      wsUrl: toWsUrl(roomId),
      playerId,
      playerToken,
      role,
      settings: registerResult.data.settings,
      isHost: false,
    };

    return NextResponse.json(response, { status: 200 });
  } catch {
    console.error("Failed to join room", { roomId });
    const error: HttpErrorResponse = {
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to join room",
      },
    };
    return NextResponse.json(error, { status: 500 });
  }
}
