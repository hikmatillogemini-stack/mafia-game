import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export const useRealtimeGame = (roomId) => {
  const [room, setRoom] = useState(null);
  const [players, setPlayers] = useState([]);
  const [myRole, setMyRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!roomId) {
      setLoading(false);
      return;
    }

    const fetchInitialData = async () => {
      try {
        const playerId = localStorage.getItem('playerId');

        const [roomRes, publicPlayersRes, myPlayerRes] = await Promise.all([
          supabase.from('rooms').select('*').eq('id', roomId).single(),
          supabase.from('public_players').select('*').eq('room_id', roomId),
          playerId ? supabase.from('players').select('role, is_alive').eq('id', playerId).single() : Promise.resolve({ data: null })
        ]);

        if (roomRes.error) throw roomRes.error;
        if (publicPlayersRes.error) throw publicPlayersRes.error;

        setRoom(roomRes.data);
        setPlayers(publicPlayersRes.data);
        if (myPlayerRes.data) {
          setMyRole(myPlayerRes.data.role);
        }
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    fetchInitialData();

    const roomChannel = supabase
      .channel(`room:${roomId}`)
      .on('postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        (payload) => setRoom(payload.new)
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` },
        async () => {
          // Refetch from public_players view on any player change
          const { data } = await supabase
            .from('public_players')
            .select('*')
            .eq('room_id', roomId);
          if (data) setPlayers(data);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(roomChannel);
    };
  }, [roomId]);

  return { room, players, myRole, loading, error };
};
