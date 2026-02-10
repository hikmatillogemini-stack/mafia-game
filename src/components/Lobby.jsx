import { useState } from 'react';
import { supabase } from '../supabaseClient';

export default function Lobby() {
  const [nickname, setNickname] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [activeTab, setActiveTab] = useState('create');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generateRoomCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const handleCreateRoom = async () => {
    if (!nickname.trim()) {
      setError('Enter your nickname');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const code = generateRoomCode();
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .insert({ code })
        .select()
        .single();

      if (roomError) throw roomError;

      // Check if player already exists in this room
      const { data: existingPlayer } = await supabase
        .from('players')
        .select('id')
        .eq('room_id', room.id)
        .eq('user_id', user.id)
        .single();

      let playerId;
      if (existingPlayer) {
        playerId = existingPlayer.id;
      } else {
        const { data: player, error: playerError } = await supabase
          .from('players')
          .insert({ room_id: room.id, user_id: user.id, nickname })
          .select()
          .single();

        if (playerError) throw playerError;
        playerId = player.id;
      }

      localStorage.setItem('playerId', playerId);
      localStorage.setItem('roomId', room.id);
      
      window.location.href = `/room/${room.id}`;
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!nickname.trim() || !roomCode.trim()) {
      setError('Enter nickname and room code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .select()
        .eq('code', roomCode.toUpperCase())
        .single();

      if (roomError || !room) throw new Error('Room not found');

      // Check if player already exists in this room
      const { data: existingPlayer } = await supabase
        .from('players')
        .select('id')
        .eq('room_id', room.id)
        .eq('user_id', user.id)
        .single();

      let playerId;
      if (existingPlayer) {
        playerId = existingPlayer.id;
      } else {
        const { data: player, error: playerError } = await supabase
          .from('players')
          .insert({ room_id: room.id, user_id: user.id, nickname })
          .select()
          .single();

        if (playerError) throw playerError;
        playerId = player.id;
      }

      localStorage.setItem('playerId', playerId);
      localStorage.setItem('roomId', room.id);
      
      window.location.href = `/room/${room.id}`;
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-lg shadow-2xl p-8 w-full max-w-md border border-slate-700">
        <h1 className="text-4xl font-bold text-red-500 text-center mb-8">🎭 MAFIA</h1>
        
        <input
          type="text"
          placeholder="Enter your nickname"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          className="w-full bg-slate-700 text-slate-100 px-4 py-3 rounded-lg mb-6 focus:outline-none focus:ring-2 focus:ring-red-500"
        />

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('create')}
            className={`flex-1 py-2 rounded-lg font-semibold transition ${
              activeTab === 'create'
                ? 'bg-red-600 text-white'
                : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
            }`}
          >
            Create Room
          </button>
          <button
            onClick={() => setActiveTab('join')}
            className={`flex-1 py-2 rounded-lg font-semibold transition ${
              activeTab === 'join'
                ? 'bg-red-600 text-white'
                : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
            }`}
          >
            Join Room
          </button>
        </div>

        {activeTab === 'create' ? (
          <button
            onClick={handleCreateRoom}
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg transition disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create New Room'}
          </button>
        ) : (
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Enter room code"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              className="w-full bg-slate-700 text-slate-100 px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <button
              onClick={handleJoinRoom}
              disabled={loading}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg transition disabled:opacity-50"
            >
              {loading ? 'Joining...' : 'Join Room'}
            </button>
          </div>
        )}

        {error && (
          <div className="mt-4 bg-red-900/50 border border-red-500 text-red-200 px-4 py-2 rounded-lg text-sm">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
