import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getLeaderboard } from "@leet99/supabase";
import type { LeaderboardResponse, HttpErrorResponse } from "@leet99/contracts";

const LeaderboardQuerySchema = z.object({
  window: z.string().default("all"),
  limit: z
    .string()
    .default("50")
    .transform((val) => Math.min(Math.max(Number.parseInt(val, 10), 1), 100))
    .refine((val) => !Number.isNaN(val), { message: "Invalid limit" }),
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const parseResult = LeaderboardQuerySchema.safeParse({
    window: searchParams.get("window") ?? "all",
    limit: searchParams.get("limit") ?? "50",
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

  const result = await getLeaderboard(limit);

  if (!result.ok) {
    const error: HttpErrorResponse = {
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to fetch leaderboard",
      },
    };
    return NextResponse.json(error, { status: 500 });
  }

  const response: LeaderboardResponse = result.data;

  return NextResponse.json(response, {
    status: 200,
    headers: { "Cache-Control": "public, max-age=60" },
  });
}
