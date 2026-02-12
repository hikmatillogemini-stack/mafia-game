import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const fisherYatesShuffle = (array: any[]) => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

const getRoleDistribution = (playerCount: number) => {
  if (playerCount < 4) throw new Error('Minimum 4 players required');
  
  const roles = [];
  
  if (playerCount >= 4 && playerCount <= 6) {
    roles.push('mafia', 'doctor', 'detective');
    const citizenCount = playerCount - 3;
    for (let i = 0; i < citizenCount; i++) roles.push('citizen');
  } else if (playerCount >= 7 && playerCount <= 9) {
    roles.push('mafia', 'mafia', 'doctor', 'detective');
    const citizenCount = playerCount - 4;
    for (let i = 0; i < citizenCount; i++) roles.push('citizen');
  } else {
    roles.push('mafia', 'mafia', 'mafia', 'doctor', 'detective');
    const citizenCount = playerCount - 5;
    for (let i = 0; i < citizenCount; i++) roles.push('citizen');
  }
  
  return roles;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { roomId } = await req.json();

    if (!roomId) {
      throw new Error('roomId is required');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('id')
      .eq('room_id', roomId);

    if (playersError) throw playersError;
    if (!players || players.length < 4) {
      throw new Error('Minimum 4 players required to start the game');
    }

    const roles = getRoleDistribution(players.length);
    const shuffledRoles = fisherYatesShuffle(roles);

    const updates = players.map((player, index) => ({
      id: player.id,
      role: shuffledRoles[index],
      team: shuffledRoles[index] === 'mafia' ? 'mafia' : 'town'
    }));

    for (const update of updates) {
      const { error } = await supabase
        .from('players')
        .update({ role: update.role, team: update.team })
        .eq('id', update.id);
      
      if (error) throw error;
    }

    const { error: roomError } = await supabase
      .from('rooms')
      .update({ phase: 'night' })
      .eq('id', roomId);

    if (roomError) throw roomError;

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Game started successfully',
        playerCount: players.length,
        phase: 'night'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
