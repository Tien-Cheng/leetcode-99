import { NextRequest, NextResponse } from "next/server";
import {
  CreateRoomRequestSchema,
  type CreateRoomResponse,
  type HttpErrorResponse,
  RoomSettingsSchema,
} from "@leet99/contracts";
import { registerPartyPlayer, toWsUrl } from "@/server/partykit";

/**
 * POST /api/rooms - Create a new room
 *
 * Creates a room in lobby phase and returns credentials for the host.
 */
export async function POST(req: NextRequest) {
  let roomId: string | undefined;

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

    // Generate player credentials
    const playerId = `p_${crypto.randomUUID()}`;
    const playerToken = `pt_${crypto.randomUUID()}`;

    // Merge settings with defaults
    const settings = RoomSettingsSchema.parse({
      ...settingsOverride,
    });

    const maxAttempts = 5;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      roomId = generateRoomId();

      const registerResult = await registerPartyPlayer(roomId, {
        playerId,
        playerToken,
        username: trimmedUsername,
        role: "player",
        isHost: true,
        settings,
      });

      if (registerResult.ok) {
        const response: CreateRoomResponse = {
          roomId,
          wsUrl: toWsUrl(roomId),
          playerId,
          playerToken,
          role: "player",
          isHost: true,
          settings: registerResult.data.settings,
        };

        return NextResponse.json(response, { status: 201 });
      }

      if (registerResult.status === 409) {
        continue;
      }

      return NextResponse.json(registerResult.error, {
        status: registerResult.status,
      });
    }

    const error: HttpErrorResponse = {
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to create room",
      },
    };
    return NextResponse.json(error, { status: 500 });
  } catch {
    console.error("Failed to create room", { roomId });
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
  const bytes = new Uint8Array(6);

  crypto.getRandomValues(bytes);

  let result = "";
  for (let i = 0; i < 6; i++) {
    const index = bytes[i]! & 31;
    result += chars[index]!;
  }

  return result;
}
