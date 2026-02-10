-- Drop the old INSERT policy that conflicts
DROP POLICY IF EXISTS "Users can insert themselves as players" ON players;

-- Drop and recreate the bot policy
DROP POLICY IF EXISTS "Authenticated users can add bots" ON players;

CREATE POLICY "Users can insert players and bots"
    ON players FOR INSERT
    WITH CHECK (
        (is_bot = true AND auth.uid() IS NOT NULL) 
        OR 
        (is_bot = false AND user_id = auth.uid())
    );

-- Grant permissions on public_players view
GRANT SELECT ON public_players TO anon, authenticated;
