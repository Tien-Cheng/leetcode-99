import { NextRequest, NextResponse } from "next/server";
import {
  JoinRoomRequestSchema,
  type JoinRoomResponse,
  type HttpErrorResponse,
  RoomSettingsSchema,
} from "@leet99/contracts";

type RouteParams = {
  params: Promise<{ roomId: string }>;
};

/**
 * POST /api/rooms/:roomId/join - Join an existing room
 *
 * Joins a room as player (lobby only) or spectator (any time).
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { roomId } = await params;
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

    const { username, role } = parsed.data;

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

    // TODO: Verify room exists and check constraints:
    // - ROOM_NOT_FOUND if room doesn't exist
    // - ROOM_FULL if role=player and room is at capacity
    // - USERNAME_TAKEN if username is already taken in room
    // - MATCH_ALREADY_STARTED if role=player and match is running

    // For now, we return mock data to allow the client to proceed

    // Generate player credentials
    const playerId = `p_${generateId()}`;
    const playerToken = `pt_${generateId()}`;

    // Build WebSocket URL
    const partykitHost = process.env.PARTYKIT_HOST || "http://localhost:1999";
    const partykitProject = process.env.PARTYKIT_PROJECT || "leet99";
    const wsUrl = `${partykitHost}/parties/${partykitProject}/${roomId}`;

    // Mock settings (in production, fetch from room state)
    const settings = RoomSettingsSchema.parse({});

    const response: JoinRoomResponse = {
      roomId,
      wsUrl,
      playerId,
      playerToken,
      role: role ?? "player",
      isHost: false,
      settings,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (err) {
    console.error("Error joining room:", err);
    const error: HttpErrorResponse = {
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to join room",
      },
    };
    return NextResponse.json(error, { status: 500 });
  }
}

/**
 * Generate a random ID for player/token
 */
function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}
