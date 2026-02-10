-- Allow NULL user_id for bots
ALTER TABLE players 
ALTER COLUMN user_id DROP NOT NULL;

-- Add is_bot flag
ALTER TABLE players 
ADD COLUMN is_bot BOOLEAN DEFAULT false;

-- Add constraint: if not a bot, user_id must be present
ALTER TABLE players 
ADD CONSTRAINT user_id_required_for_humans 
CHECK (is_bot = true OR user_id IS NOT NULL);

-- Drop old INSERT policies
DROP POLICY IF EXISTS "Users can insert themselves as players" ON players;
DROP POLICY IF EXISTS "Authenticated users can add bots" ON players;

-- New RLS Policy: Allow users to insert themselves OR bots
CREATE POLICY "Users can insert players and bots"
    ON players FOR INSERT
    WITH CHECK (
        (is_bot = true AND auth.uid() IS NOT NULL) 
        OR 
        (is_bot = false AND user_id = auth.uid())
    );

-- Update existing SELECT policy to include bots
DROP POLICY IF EXISTS "Users can read their own player data" ON players;

CREATE POLICY "Users can read their own player data"
    ON players FOR SELECT
    USING (user_id = auth.uid() OR is_bot = true);

-- Update public_players view to include is_bot
DROP VIEW IF EXISTS public_players;

CREATE VIEW public_players AS
SELECT 
    id,
    room_id,
    user_id,
    nickname,
    is_alive,
    team,
    is_bot,
    created_at
FROM players;

-- Grant permissions on view
GRANT SELECT ON public_players TO anon, authenticated;
