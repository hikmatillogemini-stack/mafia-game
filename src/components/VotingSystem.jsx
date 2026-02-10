import { useState } from 'react';
import { UserX, Vote } from 'lucide-react';
import { supabase } from '../supabaseClient';

export default function VotingSystem({ players, votes }) {
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [loading, setLoading] = useState(false);

  const alivePlayers = players.filter(p => p.is_alive);
  
  const getVoteCount = (playerId) => {
    return votes.filter(v => v.suspect_id === playerId).length;
  };

  const handleVote = async () => {
    if (!selectedPlayer) return;

    setLoading(true);
    const roomId = localStorage.getItem('roomId');
    const playerId = localStorage.getItem('playerId');

    try {
      const { error } = await supabase
        .from('votes')
        .upsert({
          voter_id: playerId,
          suspect_id: selectedPlayer.id,
          room_id: roomId
        }, { onConflict: 'voter_id,room_id' });

      if (error) throw error;
      setSelectedPlayer(null);
    } catch (err) {
      console.error('Vote failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold text-red-500 mb-4 flex items-center gap-2">
        <Vote /> Vote to Eliminate
      </h2>

      <div className="space-y-2 mb-4">
        {alivePlayers.map((player) => {
          const voteCount = getVoteCount(player.id);
          
          return (
            <div
              key={player.id}
              onClick={() => setSelectedPlayer(player)}
              className={`
                bg-slate-800 p-4 rounded-lg cursor-pointer transition-all hover:bg-slate-700
                ${selectedPlayer?.id === player.id ? 'ring-2 ring-red-500' : ''}
              `}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center">
                    {player.avatar_url || '👤'}
                  </div>
                  <span className="text-slate-100 font-semibold">{player.nickname}</span>
                </div>
                
                {voteCount > 0 && (
                  <div className="flex items-center gap-2 bg-red-600 px-3 py-1 rounded-full">
                    <UserX size={16} />
                    <span className="font-bold">{voteCount}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {selectedPlayer && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-lg p-6 max-w-sm w-full border-2 border-red-500">
            <h3 className="text-xl font-bold text-slate-100 mb-4">Confirm Vote</h3>
            <p className="text-slate-300 mb-6">
              Vote to eliminate <span className="text-red-500 font-bold">{selectedPlayer.nickname}</span>?
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleVote}
                disabled={loading}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg transition disabled:opacity-50"
              >
                {loading ? 'Voting...' : 'Confirm'}
              </button>
              <button
                onClick={() => setSelectedPlayer(null)}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-100 font-bold py-3 rounded-lg transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
