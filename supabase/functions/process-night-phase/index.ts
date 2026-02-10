import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GameAction {
  id: string;
  actor_id: string;
  target_id: string | null;
  action_type: 'kill' | 'heal' | 'check' | 'block';
}

interface Player {
  id: string;
  role: string;
  is_alive: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { roomId, roundNumber } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch actions and players
    const [actionsRes, playersRes] = await Promise.all([
      supabase
        .from('game_actions')
        .select('*')
        .eq('room_id', roomId)
        .eq('round_number', roundNumber),
      supabase
        .from('players')
        .select('id, role, is_alive')
        .eq('room_id', roomId)
    ]);

    if (actionsRes.error) throw actionsRes.error;
    if (playersRes.error) throw playersRes.error;

    const actions = actionsRes.data as GameAction[];
    const players = playersRes.data as Player[];
    const playerMap = new Map(players.map(p => [p.id, p]));

    // Priority 1: Identify blocked players
    const blockedPlayers = new Set(
      actions
        .filter(a => a.action_type === 'block' && a.target_id)
        .map(a => a.target_id!)
    );

    // Filter out actions from blocked or dead players
    const validActions = actions.filter(a => {
      const actor = playerMap.get(a.actor_id);
      return actor?.is_alive && !blockedPlayers.has(a.actor_id);
    });

    // Priority 2: Identify healed players
    const healedPlayers = new Set(
      validActions
        .filter(a => a.action_type === 'heal' && a.target_id)
        .map(a => a.target_id!)
    );

    // Priority 3: Process kills
    const killedPlayers = new Set(
      validActions
        .filter(a => a.action_type === 'kill' && a.target_id && !healedPlayers.has(a.target_id!))
        .map(a => a.target_id!)
    );

    // Priority 4: Process detective checks
    const detectiveResults = validActions
      .filter(a => a.action_type === 'check' && a.target_id)
      .map(a => ({
        detective_id: a.actor_id,
        target_id: a.target_id!,
        target_role: playerMap.get(a.target_id!)?.role
      }));

    // Update killed players
    if (killedPlayers.size > 0) {
      const { error } = await supabase
        .from('players')
        .update({ is_alive: false })
        .in('id', Array.from(killedPlayers));
      
      if (error) throw error;
    }

    // Update room phase to day
    const { error: roomError } = await supabase
      .from('rooms')
      .update({ phase: 'day' })
      .eq('id', roomId);

    if (roomError) throw roomError;

    // Build summary
    const summary = {
      blocked: Array.from(blockedPlayers),
      healed: Array.from(healedPlayers),
      killed: Array.from(killedPlayers),
      detective_results: detectiveResults,
      phase: 'day'
    };

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
