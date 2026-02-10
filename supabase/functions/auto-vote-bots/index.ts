import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Player {
  id: string;
  is_bot: boolean;
  is_alive: boolean;
  team: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { roomId } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch all players
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('id, is_bot, is_alive, team')
      .eq('room_id', roomId);

    if (playersError) throw playersError;

    const aliveBots = players.filter(p => p.is_bot && p.is_alive);
    const alivePlayers = players.filter(p => p.is_alive);

    let votesAdded = 0;

    for (const bot of aliveBots) {
      // Check if bot already voted
      const { data: existingVote } = await supabase
        .from('votes')
        .select('id')
        .eq('voter_id', bot.id)
        .eq('room_id', roomId)
        .single();

      if (existingVote) continue; // Bot already voted

      // Determine voting target
      let targets = alivePlayers.filter(p => p.id !== bot.id);

      // Mafia bots prefer voting for town members
      if (bot.team === 'mafia') {
        const townTargets = targets.filter(p => p.team === 'town');
        if (townTargets.length > 0 && Math.random() > 0.3) {
          targets = townTargets;
        }
      }

      if (targets.length === 0) continue;

      const target = targets[Math.floor(Math.random() * targets.length)];

      // Insert vote
      const { error: voteError } = await supabase
        .from('votes')
        .insert({
          voter_id: bot.id,
          suspect_id: target.id,
          room_id: roomId
        });

      if (voteError) throw voteError;
      votesAdded++;
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `${votesAdded} bot votes added`,
        bots_voted: votesAdded
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
