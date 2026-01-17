import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRoomMatches } from "@leet99/supabase";
import type {
  RoomMatchHistoryResponse,
  HttpErrorResponse,
} from "@leet99/contracts";

const RoomMatchHistoryQuerySchema = z.object({
  limit: z
    .string()
    .default("20")
    .transform((val) => Math.min(Math.max(Number.parseInt(val, 10), 1), 100))
    .refine((val) => !Number.isNaN(val), { message: "Invalid limit" }),
});

type RouteParams = {
  params: Promise<{ roomId: string }>;
};

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { roomId } = await params;
  const { searchParams } = new URL(req.url);

  const parseResult = RoomMatchHistoryQuerySchema.safeParse({
    limit: searchParams.get("limit") ?? "20",
  });

  if (!parseResult.success) {
    const error: HttpErrorResponse = {
      error: {
        code: "BAD_REQUEST",
        message: "Invalid query parameters",
        details: parseResult.error.flatten(),
      },
    };
    return NextResponse.json(error, { status: 400 });
  }

  const { limit } = parseResult.data;

  const result = await getRoomMatches(roomId, limit);

  if (!result.ok) {
    const error: HttpErrorResponse = {
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to fetch room matches",
      },
    };
    return NextResponse.json(error, { status: 500 });
  }

  const response: RoomMatchHistoryResponse = result.data;

  return NextResponse.json(response, {
    status: 200,
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
