import { NextResponse } from "next/server";
import { fetchRoomState } from "@/server/partykit";
import {
  RoomSummaryResponseSchema,
  RoomSettingsSchema,
  type RoomSummaryResponse,
  type HttpErrorResponse,
} from "@leet99/contracts";

type RouteParams = {
  params: Promise<{ roomId: string }>;
};

export async function GET(_req: Request, { params }: RouteParams) {
  const { roomId } = await params;

  const result = await fetchRoomState(roomId);

  if (!result.ok) {
    const error: HttpErrorResponse = {
      error: {
        code: "ROOM_NOT_FOUND",
        message: "Room not found",
      },
    };
    return NextResponse.json(error, { status: 404 });
  }

  const settingsParsed = RoomSettingsSchema.safeParse(result.data.settings);

  const response: RoomSummaryResponse = {
    roomId: result.data.roomId,
    phase: result.data.phase as RoomSummaryResponse["phase"],
    settings: settingsParsed.success
      ? settingsParsed.data
      : ({} as RoomSummaryResponse["settings"]),
    counts: {
      players: result.data.playerCount,
      spectators: 0,
    },
  };

  const responseParsed = RoomSummaryResponseSchema.safeParse(response);

  if (!responseParsed.success) {
    const error: HttpErrorResponse = {
      error: {
        code: "INTERNAL_ERROR",
        message: "Invalid response shape",
        details: responseParsed.error.flatten(),
      },
    };
    return NextResponse.json(error, { status: 500 });
  }

  return NextResponse.json(responseParsed.data, {
    status: 200,
    headers: { "Cache-Control": "no-cache" },
  });
}
