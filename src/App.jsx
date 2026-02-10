import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { useRealtimeGame } from './hooks/useRealtimeGame';
import Auth from './components/Auth';
import Lobby from './components/Lobby';
import PlayerGrid from './components/PlayerGrid';
import NightActionPanel from './components/NightActionPanel';
import VotingSystem from './components/VotingSystem';
import GameChat from './components/GameChat';
import { Trophy, LogOut, Play, Moon } from 'lucide-react';
import './index.css';

function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [roomId, setRoomId] = useState(localStorage.getItem('roomId'));
  const [playerId, setPlayerId] = useState(localStorage.getItem('playerId'));
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [votes, setVotes] = useState([]);

  const { room, players, myRole, loading, error } = useRealtimeGame(roomId);
  const me = players.find(p => p.id === playerId);
  const isHost = players[0]?.id === playerId;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!roomId) return;

    const fetchVotes = async () => {
      const { data } = await supabase
        .from('votes')
        .select('*')
        .eq('room_id', roomId);
      if (data) setVotes(data);
    };

    fetchVotes();

    const channel = supabase
      .channel(`votes:${roomId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'votes', filter: `room_id=eq.${roomId}` },
        () => fetchVotes()
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [roomId]);

  const startGame = async () => {
    try {
      const { error } = await supabase.functions.invoke('start-game', {
        body: { roomId }
      });
      if (error) throw error;
    } catch (err) {
      alert('Failed to start game: ' + err.message);
    }
  };

  const endNight = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('process-night-phase', {
        body: { roomId, roundNumber: 1 }
      });
      if (error) throw error;
      if (data?.winner) {
        alert(`Game Over! ${data.winner} wins!`);
      }
    } catch (err) {
      alert('Failed to process night: ' + err.message);
    }
  };

  const leaveRoom = () => {
    localStorage.removeItem('roomId');
    localStorage.removeItem('playerId');
    setRoomId(null);
    setPlayerId(null);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    leaveRoom();
  };

  const addBot = async () => {
    if (!roomId) return;

    const botNames = ['Bot-Alpha', 'Bot-Bravo', 'Bot-Charlie', 'Bot-Delta', 'Bot-Echo', 'Bot-Foxtrot'];
    const randomName = botNames[Math.floor(Math.random() * botNames.length)] + '-' + Math.floor(Math.random() * 1000);

    try {
      const { error } = await supabase
        .from('players')
        .insert({
          room_id: roomId,
          nickname: randomName,
          is_bot: true,
          user_id: null,
          is_alive: true
        });

      if (error) throw error;
    } catch (err) {
      alert('Failed to add bot: ' + err.message);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-100 text-xl">Loading...</div>
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  if (!roomId) {
    return <Lobby />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-100 text-xl">Loading game...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-red-500 text-xl">Error: {error}</div>
      </div>
    );
  }

  if (room?.phase === 'finished') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 rounded-lg p-8 max-w-md w-full text-center border-2 border-yellow-500">
          <Trophy className="w-20 h-20 text-yellow-500 mx-auto mb-4" />
          <h1 className="text-4xl font-bold text-slate-100 mb-4">Game Over!</h1>
          <p className="text-2xl text-yellow-500 mb-6">Winner: {room.winner || 'Unknown'}</p>
          <button
            onClick={leaveRoom}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg transition"
          >
            Leave Room
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <div className="flex flex-col lg:flex-row h-screen">
        {/* Main Game Area */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="bg-slate-800 border-b border-slate-700 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-red-500">🎭 MAFIA</h1>
                <p className="text-sm text-slate-400">Room: {room?.code}</p>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold capitalize">{room?.phase}</div>
                {myRole && (
                  <div className="text-sm text-yellow-500">Role: {myRole}</div>
                )}
              </div>
              <button
                onClick={handleLogout}
                className="bg-slate-700 hover:bg-slate-600 p-2 rounded-lg transition"
                title="Logout"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>

          {/* Player Grid */}
          <div className="flex-1 overflow-y-auto">
            <PlayerGrid
              players={players}
              currentUserId={me?.user_id}
              onSelectPlayer={setSelectedPlayer}
            />
          </div>

          {/* Action Panel */}
          <div className="bg-slate-800 border-t border-slate-700">
            {room?.phase === 'lobby' && (
              <div className="p-4 text-center space-y-3">
                <p className="text-slate-400 mb-4">Waiting for players... ({players.length} joined)</p>
                {isHost && (
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={addBot}
                      className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg transition flex items-center gap-2"
                    >
                      🤖 Add AI Bot
                    </button>
                    {players.length >= 4 && (
                      <button
                        onClick={startGame}
                        className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition flex items-center gap-2"
                      >
                        <Play size={20} /> Start Game
                      </button>
                    )}
                  </div>
                )}
                {isHost && players.length < 4 && (
                  <p className="text-red-500">Need at least 4 players to start</p>
                )}
              </div>
            )}

            {room?.phase === 'night' && me?.is_alive && myRole && (
              <div>
                <NightActionPanel
                  currentUserRole={myRole}
                  selectedPlayer={selectedPlayer}
                  onConfirmAction={() => setSelectedPlayer(null)}
                />
                {isHost && (
                  <button
                    onClick={endNight}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 transition flex items-center justify-center gap-2"
                  >
                    <Moon size={16} /> End Night (Host)
                  </button>
                )}
              </div>
            )}

            {(room?.phase === 'day' || room?.phase === 'voting') && (
              <div className="max-h-96 overflow-y-auto">
                <VotingSystem players={players} votes={votes} />
              </div>
            )}
          </div>
        </div>

        {/* Chat Sidebar */}
        <div className="lg:w-96 h-64 lg:h-screen border-t lg:border-t-0 lg:border-l border-slate-700">
          <GameChat roomId={roomId} players={players} />
        </div>
      </div>
    </div>
  );
}

export default App;
