import { NextRequest, NextResponse } from "next/server";
import { getMatchResults } from "@leet99/supabase";
import type {
  MatchResultsResponse,
  HttpErrorResponse,
} from "@leet99/contracts";

type RouteParams = {
  params: Promise<{ matchId: string }>;
};

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { matchId } = await params;

  const result = await getMatchResults(matchId);

  if (!result.ok) {
    const error: HttpErrorResponse = {
      error: {
        code: "MATCH_NOT_FOUND",
        message: "Match not found",
      },
    };
    return NextResponse.json(error, { status: 404 });
  }

  const response: MatchResultsResponse = result.data;

  return NextResponse.json(response, {
    status: 200,
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
