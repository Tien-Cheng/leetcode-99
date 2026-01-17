-- Create matches table
-- Stores match results for leaderboards and match history
CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ NOT NULL,
  end_reason TEXT NOT NULL CHECK (end_reason IN ('lastAlive', 'timeExpired')),
  settings JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add comment
COMMENT ON TABLE matches IS 'Stores completed match results for leaderboards and match history';

-- Create match_players table
-- Stores player standings for each match
CREATE TABLE IF NOT EXISTS match_players (
  match_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  username TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('player', 'bot')),
  score INTEGER NOT NULL DEFAULT 0,
  rank INTEGER NOT NULL,
  eliminated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (match_id, player_id),
  CONSTRAINT fk_match_players_match_id 
    FOREIGN KEY (match_id) 
    REFERENCES matches(id) 
    ON DELETE CASCADE
);

-- Add comment
COMMENT ON TABLE match_players IS 'Stores player standings for each completed match';

-- Add indexes for common queries
-- Index for room match history (GET /api/rooms/:roomId/matches)
CREATE INDEX IF NOT EXISTS idx_matches_room_id_started_at 
  ON matches(room_id, started_at DESC);

-- Index for leaderboard queries (sorted by score desc, tie-break by match.endAt desc)
CREATE INDEX IF NOT EXISTS idx_match_players_score_match_ended_at 
  ON match_players(score DESC, match_id);

-- Index for match lookup (GET /api/matches/:matchId)
CREATE INDEX IF NOT EXISTS idx_match_players_match_id_rank 
  ON match_players(match_id, rank);

-- Index for match end time lookup (used in leaderboard tie-break)
CREATE INDEX IF NOT EXISTS idx_matches_ended_at 
  ON matches(ended_at DESC);

-- Enable Row Level Security (RLS)
-- For MVP, we allow public read access but restrict writes to authenticated service role
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_players ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Allow public read access (for leaderboards and match results)
CREATE POLICY "Allow public read access on matches"
  ON matches FOR SELECT
  USING (true);

CREATE POLICY "Allow public read access on match_players"
  ON match_players FOR SELECT
  USING (true);

-- Only service role can insert/update (PartyKit server will write via service role)
-- Note: In production, you may want to add more restrictive policies
-- For MVP, we rely on service role key being server-side only
CREATE POLICY "Allow service role to insert matches"
  ON matches FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Allow service role to insert match_players"
  ON match_players FOR INSERT
  WITH CHECK (auth.role() = 'service_role');
