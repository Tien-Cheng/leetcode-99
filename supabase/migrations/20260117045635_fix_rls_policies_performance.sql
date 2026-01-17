-- Drop existing policies
DROP POLICY IF EXISTS "Allow service role to insert matches" ON matches;
DROP POLICY IF EXISTS "Allow service role to insert match_players" ON match_players;

-- Recreate policies with optimized auth function calls
-- Using (select auth.role()) instead of auth.role() for better performance
CREATE POLICY "Allow service role to insert matches"
  ON matches FOR INSERT
  WITH CHECK ((select auth.role()) = 'service_role');

CREATE POLICY "Allow service role to insert match_players"
  ON match_players FOR INSERT
  WITH CHECK ((select auth.role()) = 'service_role');
