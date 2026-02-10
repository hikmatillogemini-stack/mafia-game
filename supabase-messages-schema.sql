-- Create messages table
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Players can read messages from their room
CREATE POLICY "Players can read messages in their room"
    ON messages FOR SELECT
    USING (
        room_id IN (
            SELECT room_id FROM players WHERE user_id = auth.uid()
        )
    );

-- RLS Policy: Players can insert messages in their room
CREATE POLICY "Players can send messages in their room"
    ON messages FOR INSERT
    WITH CHECK (
        player_id IN (
            SELECT id FROM players WHERE user_id = auth.uid()
        )
    );

-- RLS Policy: Service role can manage all messages
CREATE POLICY "Service role can manage all messages"
    ON messages FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Create index for performance
CREATE INDEX idx_messages_room_id ON messages(room_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
