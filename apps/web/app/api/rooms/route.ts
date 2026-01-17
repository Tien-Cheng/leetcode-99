import { NextRequest, NextResponse } from "next/server";
import {
  CreateRoomRequestSchema,
  type CreateRoomResponse,
  type HttpErrorResponse,
  RoomSettingsSchema,
} from "@leet99/contracts";

/**
 * POST /api/rooms - Create a new room
 *
 * Creates a room in lobby phase and returns credentials for the host.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CreateRoomRequestSchema.safeParse(body);

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

    const { username, settings: settingsOverride } = parsed.data;

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

    // Generate room ID (6 chars, URL-safe)
    const roomId = generateRoomId();

    // Generate player credentials
    const playerId = `p_${generateId()}`;
    const playerToken = `pt_${generateId()}`;

    // Merge settings with defaults
    const settings = RoomSettingsSchema.parse({
      ...settingsOverride,
    });

    // Build WebSocket URL
    // In production, this would be the PartyKit host
    const partykitHost = process.env.PARTYKIT_HOST || "http://localhost:1999";
    const partykitProject = process.env.PARTYKIT_PROJECT || "leet99";
    const wsUrl = `${partykitHost}/parties/${partykitProject}/${roomId}`;

    // TODO: Store room state in PartyKit or a backing store
    // For now, we return mock data to allow the client to proceed

    const response: CreateRoomResponse = {
      roomId,
      wsUrl,
      playerId,
      playerToken,
      role: "player",
      isHost: true,
      settings,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (err) {
    console.error("Error creating room:", err);
    const error: HttpErrorResponse = {
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to create room",
      },
    };
    return NextResponse.json(error, { status: 500 });
  }
}

/**
 * Generate a short, URL-safe room ID
 */
function generateRoomId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

/**
 * Generate a random ID for player/token
 */
function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}
