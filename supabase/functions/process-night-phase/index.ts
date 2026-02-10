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
  team: string;
  is_bot: boolean;
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

    // Fetch players first
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('id, role, is_alive, team, is_bot')
      .eq('room_id', roomId);

    if (playersError) throw playersError;

    // Generate bot actions
    const livingBots = players.filter(p => p.is_bot && p.is_alive);
    
    for (const bot of livingBots) {
      // Check if bot already acted this round
      const { data: existingAction } = await supabase
        .from('game_actions')
        .select('id')
        .eq('actor_id', bot.id)
        .eq('round_number', roundNumber)
        .single();

      if (existingAction) continue; // Bot already acted

      let actionType: 'kill' | 'heal' | 'check' | null = null;
      let targetId: string | null = null;

      if (bot.role === 'mafia') {
        actionType = 'kill';
        const targets = players.filter(p => p.is_alive && p.team !== 'mafia' && p.id !== bot.id);
        if (targets.length > 0) {
          targetId = targets[Math.floor(Math.random() * targets.length)].id;
        }
      } else if (bot.role === 'doctor') {
        actionType = 'heal';
        const targets = players.filter(p => p.is_alive && p.id !== bot.id);
        if (targets.length > 0) {
          targetId = targets[Math.floor(Math.random() * targets.length)].id;
        }
      } else if (bot.role === 'detective') {
        actionType = 'check';
        const targets = players.filter(p => p.is_alive && p.id !== bot.id);
        if (targets.length > 0) {
          targetId = targets[Math.floor(Math.random() * targets.length)].id;
        }
      }

      // Insert bot action
      if (actionType && targetId) {
        await supabase.from('game_actions').insert({
          room_id: roomId,
          actor_id: bot.id,
          target_id: targetId,
          action_type: actionType,
          round_number: roundNumber
        });
      }
    }

    // Fetch actions and players
    const [actionsRes, playersRes] = await Promise.all([
      supabase
        .from('game_actions')
        .select('*')
        .eq('room_id', roomId)
        .eq('round_number', roundNumber),
      supabase
        .from('players')
        .select('id, role, is_alive, team, is_bot')
        .eq('room_id', roomId)
    ]);

    if (actionsRes.error) throw actionsRes.error;
    if (playersRes.error) throw playersRes.error;

    const actions = actionsRes.data as GameAction[];
    const playerMap = new Map(playersRes.data.map(p => [p.id, p]));

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
      
      // Update player map with new death status
      killedPlayers.forEach(id => {
        const player = playerMap.get(id);
        if (player) player.is_alive = false;
      });
    }

    // Check win conditions
    const alivePlayers = Array.from(playerMap.values()).filter(p => p.is_alive);
    const mafiaCount = alivePlayers.filter(p => p.team === 'mafia').length;
    const townCount = alivePlayers.filter(p => p.team === 'town').length;

    let winner = null;
    let newPhase = 'day';

    if (mafiaCount >= townCount) {
      winner = 'MAFIA';
      newPhase = 'finished';
    } else if (mafiaCount === 0) {
      winner = 'TOWN';
      newPhase = 'finished';
    }

    // Update room phase
    const { error: roomError } = await supabase
      .from('rooms')
      .update({ phase: newPhase })
      .eq('id', roomId);

    if (roomError) throw roomError;

    // Build summary
    const summary = {
      blocked: Array.from(blockedPlayers),
      healed: Array.from(healedPlayers),
      killed: Array.from(killedPlayers),
      detective_results: detectiveResults,
      phase: newPhase,
      winner,
      alive_mafia: mafiaCount,
      alive_town: townCount
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
