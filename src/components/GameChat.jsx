import { useState, useEffect, useRef } from 'react';
import { Send, Ghost } from 'lucide-react';
import { supabase } from '../supabaseClient';

export default function GameChat({ roomId, players }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (!roomId) return;

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });

      if (!error && data) {
        setMessages(data);
        setTimeout(scrollToBottom, 100);
      }
    };

    fetchMessages();

    const channel = supabase
      .channel(`messages:${roomId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
        (payload) => {
          setMessages(prev => [...prev, payload.new]);
          setTimeout(scrollToBottom, 100);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setLoading(true);
    const playerId = localStorage.getItem('playerId');

    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          room_id: roomId,
          player_id: playerId,
          content: newMessage.trim()
        });

      if (error) throw error;
      setNewMessage('');
    } catch (err) {
      console.error('Send message failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const getPlayerInfo = (playerId) => {
    return players.find(p => p.id === playerId);
  };

  return (
    <div className="flex flex-col h-full bg-slate-800 rounded-lg border border-slate-700">
      <div className="bg-slate-900 p-3 rounded-t-lg border-b border-slate-700">
        <h3 className="text-slate-100 font-bold">Game Chat</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => {
          const player = getPlayerInfo(msg.player_id);
          const isDead = player && !player.is_alive;

          return (
            <div key={msg.id} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className={`font-semibold text-sm ${isDead ? 'text-slate-500' : 'text-slate-300'}`}>
                  {player?.nickname || 'Unknown'}
                </span>
                {isDead && (
                  <span className="flex items-center gap-1 bg-slate-700 text-slate-400 text-xs px-2 py-0.5 rounded">
                    <Ghost size={12} /> Dead
                  </span>
                )}
              </div>
              <div className={`
                p-2 rounded-lg max-w-[80%]
                ${isDead 
                  ? 'bg-slate-900 text-slate-500 border border-slate-700 opacity-70' 
                  : 'bg-slate-700 text-slate-100'
                }
              `}>
                {msg.content}
              </div>
              <span className="text-xs text-slate-500">
                {new Date(msg.created_at).toLocaleTimeString()}
              </span>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-slate-700 text-slate-100 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          <button
            type="submit"
            disabled={loading || !newMessage.trim()}
            className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-lg transition disabled:opacity-50"
          >
            <Send size={20} />
          </button>
        </div>
      </form>
    </div>
  );
}
