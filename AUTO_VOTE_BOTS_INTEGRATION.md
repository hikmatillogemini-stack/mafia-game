# Auto-Vote Bots Integration Guide

## Function: auto-vote-bots

### Purpose
Automatically generates votes for AI bots during the day/voting phase.

### Logic
- Fetches all alive bots in the room
- Checks if they already voted (prevents duplicates)
- Generates random votes for alive players
- Mafia bots have 70% chance to vote for town members (team coordination)

### When to Call

**Option 1: Manual Trigger (Recommended)**
Add a "Process Votes" button in App.jsx for the host during voting phase:

```javascript
const processVotes = async () => {
  try {
    // First, let bots vote
    await supabase.functions.invoke('auto-vote-bots', {
      body: { roomId }
    });
    
    // Then process the voting results
    // (You'll need to create a process-voting-phase function)
    const { data, error } = await supabase.functions.invoke('process-voting-phase', {
      body: { roomId }
    });
    
    if (error) throw error;
  } catch (err) {
    alert('Failed to process votes: ' + err.message);
  }
};
```

**Option 2: Automatic Timer**
Call it automatically after X seconds in voting phase:

```javascript
useEffect(() => {
  if (room?.phase === 'voting' && isHost) {
    const timer = setTimeout(async () => {
      await supabase.functions.invoke('auto-vote-bots', {
        body: { roomId }
      });
    }, 30000); // 30 seconds
    
    return () => clearTimeout(timer);
  }
}, [room?.phase, isHost, roomId]);
```

**Option 3: Before Phase Transition**
Call it in your existing phase transition logic before moving from 'voting' to 'night'.

### Deploy
```bash
supabase functions deploy auto-vote-bots
```
