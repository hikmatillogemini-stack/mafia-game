export default function PlayerGrid({ players, currentUserId, onSelectPlayer }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 p-4">
      {players.map((player) => {
        const isCurrentUser = player.user_id === currentUserId;
        const isDead = !player.is_alive;

        return (
          <div
            key={player.id}
            onClick={() => onSelectPlayer(player.id)}
            className={`
              relative bg-slate-800 rounded-lg p-4 cursor-pointer transition-all hover:scale-105
              ${isDead ? 'grayscale opacity-60' : ''}
              ${isCurrentUser ? 'border-4 border-yellow-500' : 'border-2 border-slate-700'}
            `}
          >
            {isDead && (
              <div className="absolute top-2 right-2 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded">
                DEAD
              </div>
            )}
            
            <div className="flex flex-col items-center gap-2">
              <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center text-3xl">
                {player.avatar_url || '👤'}
              </div>
              <p className="text-slate-100 font-semibold text-center text-sm">
                {player.nickname}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
