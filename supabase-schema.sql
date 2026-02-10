-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create ENUM types
CREATE TYPE game_phase AS ENUM ('lobby', 'day', 'night', 'voting');
CREATE TYPE player_role AS ENUM ('mafia', 'doctor', 'detective', 'citizen');
CREATE TYPE player_team AS ENUM ('mafia', 'town');
CREATE TYPE action_type AS ENUM ('kill', 'heal', 'check', 'block');

-- Create rooms table
CREATE TABLE rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    phase game_phase DEFAULT 'lobby',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create players table
CREATE TABLE players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    nickname TEXT NOT NULL,
    role player_role,
    is_alive BOOLEAN DEFAULT true,
    team player_team,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(room_id, user_id)
);

-- Create game_actions table
CREATE TABLE game_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    actor_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    target_id UUID REFERENCES players(id) ON DELETE CASCADE,
    action_type action_type NOT NULL,
    round_number INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_actions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for rooms
CREATE POLICY "Players can read rooms they are in"
    ON rooms FOR SELECT
    USING (
        id IN (
            SELECT room_id FROM players WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Anyone can create rooms"
    ON rooms FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Service role can update rooms"
    ON rooms FOR UPDATE
    USING (auth.jwt()->>'role' = 'service_role');

-- RLS Policies for players
CREATE POLICY "Players can read players in their room"
    ON players FOR SELECT
    USING (
        room_id IN (
            SELECT room_id FROM players WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert themselves as players"
    ON players FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Players can update their own nickname"
    ON players FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (
        user_id = auth.uid() 
        AND role IS NOT DISTINCT FROM (SELECT role FROM players WHERE id = players.id)
        AND is_alive IS NOT DISTINCT FROM (SELECT is_alive FROM players WHERE id = players.id)
    );

CREATE POLICY "Service role can update all player fields"
    ON players FOR UPDATE
    USING (auth.jwt()->>'role' = 'service_role');

-- RLS Policies for game_actions
CREATE POLICY "Players can read actions in their room"
    ON game_actions FOR SELECT
    USING (
        room_id IN (
            SELECT room_id FROM players WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Players can insert their own actions"
    ON game_actions FOR INSERT
    WITH CHECK (
        actor_id IN (
            SELECT id FROM players WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Service role can manage all actions"
    ON game_actions FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE players;

-- Create indexes for performance
CREATE INDEX idx_players_room_id ON players(room_id);
CREATE INDEX idx_players_user_id ON players(user_id);
CREATE INDEX idx_game_actions_room_id ON game_actions(room_id);
CREATE INDEX idx_game_actions_actor_id ON game_actions(actor_id);
CREATE INDEX idx_rooms_code ON rooms(code);
