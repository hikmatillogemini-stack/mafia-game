import { supabase } from '../supabaseClient';

export default function NightActionPanel({ currentUserRole, selectedPlayer, onConfirmAction }) {
  const roleActions = {
    mafia: { label: 'KILL', type: 'kill', color: 'bg-red-600 hover:bg-red-700' },
    doctor: { label: 'HEAL', type: 'heal', color: 'bg-green-600 hover:bg-green-700' },
    detective: { label: 'INVESTIGATE', type: 'check', color: 'bg-blue-600 hover:bg-blue-700' }
  };

  const action = roleActions[currentUserRole];
  if (!action) return null;

  const handleAction = async () => {
    if (!selectedPlayer) return;

    const roomId = localStorage.getItem('roomId');
    const playerId = localStorage.getItem('playerId');

    try {
      const { error } = await supabase
        .from('game_actions')
        .insert({
          room_id: roomId,
          actor_id: playerId,
          target_id: selectedPlayer.id,
          action_type: action.type,
          round_number: 1
        });

      if (error) throw error;
      onConfirmAction();
    } catch (err) {
      console.error('Action failed:', err);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-slate-800 border-t-2 border-slate-700 p-4">
      <button
        onClick={handleAction}
        disabled={!selectedPlayer}
        className={`w-full ${action.color} text-white font-bold py-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {selectedPlayer 
          ? `${action.label} ${selectedPlayer.nickname}` 
          : `Select a player to ${action.label.toLowerCase()}`
        }
      </button>
    </div>
  );
}
