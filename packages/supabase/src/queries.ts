import { createServerClient } from "@leet99/supabase";
import type { Database } from "@leet99/supabase";
import type {
  MatchResultsResponse,
  LeaderboardResponse,
  RoomMatchHistoryResponse,
  RoomSettings,
  MatchEndReason,
} from "@leet99/contracts";

export async function getMatchResults(
  matchId: string,
): Promise<
  { ok: true; data: MatchResultsResponse } | { ok: false; error: Error }
> {
  const supabase = createServerClient();

  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("*")
    .eq("id", matchId)
    .single();

  if (matchError) {
    return { ok: false, error: new Error(matchError.message) };
  }

  const { data: players, error: playersError } = await supabase
    .from("match_players")
    .select("*")
    .eq("match_id", matchId)
    .order("rank", { ascending: true });

  if (playersError) {
    return { ok: false, error: new Error(playersError.message) };
  }

  const response: MatchResultsResponse = {
    match: {
      matchId: match.id,
      roomId: match.room_id,
      startAt: match.started_at,
      endAt: match.ended_at,
      endReason: match.end_reason,
      settings: match.settings as MatchResultsResponse["match"]["settings"],
    },
    standings: (players ?? []).map((player) => ({
      rank: player.rank,
      playerId: player.player_id,
      username: player.username,
      role: player.role,
      score: player.score,
    })),
  };

  return { ok: true, data: response };
}

export async function getLeaderboard(
  limit: number,
): Promise<
  { ok: true; data: LeaderboardResponse } | { ok: false; error: Error }
> {
  const supabase = createServerClient();

  const { data: entries, error } = await supabase
    .from("match_players")
    .select("player_id, username, score, match_id, matches!inner(ended_at)")
    .order("score", { ascending: false })
    .order("matches.ended_at", { ascending: false })
    .limit(limit);

  if (error) {
    return { ok: false, error: new Error(error.message) };
  }

  const typedEntries = entries as unknown as Array<{
    player_id: string;
    username: string;
    score: number;
    match_id: string;
    matches: { ended_at: string };
  }>;

  const response: LeaderboardResponse = {
    window: "all",
    entries: (typedEntries ?? []).map((entry, index) => ({
      rank: index + 1,
      username: entry.username,
      score: entry.score,
      matchId: entry.match_id,
      at: entry.matches.ended_at,
    })),
  };

  return { ok: true, data: response };
}

export async function getRoomMatches(
  roomId: string,
  limit: number,
): Promise<
  { ok: true; data: RoomMatchHistoryResponse } | { ok: false; error: Error }
> {
  const supabase = createServerClient();

  const { data: matches, error } = await supabase
    .from("matches")
    .select("id, started_at, ended_at, end_reason")
    .eq("room_id", roomId)
    .order("ended_at", { ascending: false })
    .limit(limit);

  if (error) {
    return { ok: false, error: new Error(error.message) };
  }

  const response: RoomMatchHistoryResponse = {
    roomId,
    matches: (matches ?? []).map((match) => ({
      matchId: match.id,
      startAt: match.started_at,
      endAt: match.ended_at,
      endReason: match.end_reason,
    })),
  };

  return { ok: true, data: response };
}

/**
 * Match player entry for persistence
 */
export interface MatchPlayerEntry {
  playerId: string;
  username: string;
  role: "player" | "bot";
  score: number;
  rank: number;
  eliminatedAt: string | null;
}

/**
 * Persist match results to Supabase (Section 9.2)
 * Called at the end of each match to save match data and player standings.
 */
export async function saveMatch(
  matchId: string,
  roomId: string,
  startAt: string,
  endAt: string,
  endReason: MatchEndReason,
  settings: RoomSettings,
  players: MatchPlayerEntry[],
): Promise<{ ok: true } | { ok: false; error: Error }> {
  const supabase = createServerClient();

  // Insert match record
  const { error: matchError } = await supabase.from("matches").insert({
    id: matchId,
    room_id: roomId,
    started_at: startAt,
    ended_at: endAt,
    end_reason: endReason,
    settings: settings as unknown as Record<string, unknown>,
  });

  if (matchError) {
    return { ok: false, error: new Error(matchError.message) };
  }

  // Insert player records (filter out spectators)
  const playerRecords = players
    .filter((p) => p.role === "player" || p.role === "bot")
    .map((p) => ({
      match_id: matchId,
      player_id: p.playerId,
      username: p.username,
      role: p.role,
      score: p.score,
      rank: p.rank,
      eliminated_at: p.eliminatedAt,
    }));

  if (playerRecords.length > 0) {
    const { error: playersError } = await supabase
      .from("match_players")
      .insert(playerRecords);

    if (playersError) {
      // Attempt to clean up the match record if players failed
      await supabase.from("matches").delete().eq("id", matchId);
      return { ok: false, error: new Error(playersError.message) };
    }
  }

  return { ok: true };
}
