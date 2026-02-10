-- Create public_players view (no role exposed)
CREATE OR REPLACE VIEW public_players AS
SELECT 
    id,
    room_id,
    user_id,
    nickname,
    is_alive,
    team,
    created_at
FROM players;

-- Revoke direct access to players table
REVOKE ALL ON players FROM anon, authenticated;

-- Drop existing RLS policies on players
DROP POLICY IF EXISTS "Players can read players in their room" ON players;
DROP POLICY IF EXISTS "Users can insert themselves as players" ON players;
DROP POLICY IF EXISTS "Players can update their own nickname" ON players;
DROP POLICY IF EXISTS "Service role can update all player fields" ON players;

-- New RLS Policy: Users can only see their OWN row
CREATE POLICY "Users can read their own player data"
    ON players FOR SELECT
    USING (user_id = auth.uid());

-- Users can insert themselves
CREATE POLICY "Users can insert themselves as players"
    ON players FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Users can update only their nickname (not role/is_alive)
CREATE POLICY "Players can update their own nickname"
    ON players FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (
        user_id = auth.uid() 
        AND role IS NOT DISTINCT FROM (SELECT role FROM players WHERE id = players.id)
        AND is_alive IS NOT DISTINCT FROM (SELECT is_alive FROM players WHERE id = players.id)
    );

-- Service role has full access
CREATE POLICY "Service role can manage all players"
    ON players FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- Grant SELECT on public_players view
GRANT SELECT ON public_players TO anon, authenticated;

-- Enable realtime on public_players view (if supported)
-- Note: Supabase realtime works on tables, not views
-- We'll handle this in the React hook by subscribing to players table
-- but fetching from public_players view
