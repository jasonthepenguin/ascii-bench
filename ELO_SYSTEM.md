# ELO Rating System

## Overview
This project uses a dynamic K-factor ELO rating system to rank ASCII art outputs from different models.

## How It Works

### 1. Dynamic K-Factor
The K-factor determines how much ratings change after each vote. Our system uses a **dynamic K-factor** that adapts based on how many votes an output has received:

```
K = base_K / (1 + vote_count / decay_divisor)
K = max(K, min_K)
```

**Parameters:**
- `base_K = 32` - Starting K-factor for new outputs
- `min_K = 10` - Minimum K-factor for established outputs
- `decay_divisor = 30` - Controls how quickly K decreases

**Example K-factors:**
- 0 votes: K ≈ 32 (highly volatile, learns quickly)
- 10 votes: K ≈ 21
- 30 votes: K ≈ 16
- 50 votes: K ≈ 12
- 100+ votes: K ≈ 10 (stable, changes slowly)

### 2. ELO Calculation

Standard ELO formula with individual K-factors per output:

```
Expected_A = 1 / (1 + 10^((Rating_B - Rating_A) / 400))
Expected_B = 1 / (1 + 10^((Rating_A - Rating_B) / 400))

New_Rating_Winner = Old_Rating + K_winner * (1 - Expected_Winner)
New_Rating_Loser = Old_Rating + K_loser * (0 - Expected_Loser)
```

### 3. Vote Flow

1. User votes for output A or B
2. API calls `update_elo_ratings(winner_id, loser_id)` PostgreSQL function
3. Function:
   - Calculates dynamic K-factors for both outputs
   - Computes expected win probabilities
   - Updates ELO ratings
   - Increments vote counts
4. Vote is recorded in `votes` table
5. New ratings returned to client

## Why This Approach?

### Dynamic K-Factor Benefits
- **Fast learning for new models**: When you add a new model, it quickly finds its appropriate rating
- **Stability for established models**: Models with many votes have stable ratings
- **Never fully locks in**: Even well-established models can adjust if they consistently win/lose
- **Fair comparisons**: New models with high K can catch up to their "true" rating quickly

### PostgreSQL Function Benefits
- **Atomic operations**: Row-level locking prevents race conditions
- **Transaction safety**: Both ratings update or neither does
- **Concurrency safe**: `FOR UPDATE` locks ensure votes queue properly
- **Performance**: Calculation happens in database
- **Consistency**: Same logic applied everywhere

### Concurrency Safety
The system uses **row-level locking** (`SELECT ... FOR UPDATE`) to handle simultaneous votes:
- If two votes involve the same output at the same time, they queue automatically
- No lost updates or race conditions
- Second transaction waits for first to complete, then proceeds with fresh data
- Typical wait time: <10ms (imperceptible to users)

## Tuning Parameters

If you want to adjust the system behavior, edit these values in `supabase/database.sql`:

```sql
base_k NUMERIC := 32.0;  -- Higher = more volatile initially
min_k NUMERIC := 10.0;    -- Lower = more stable eventually
decay_divisor NUMERIC := 30.0; -- Lower = faster stabilization
```

## Future Enhancements

Consider adding:
- **Tie votes**: Currently only winner/loser (could add draws)
- **Rating history**: Track rating changes over time
- **Confidence intervals**: Show uncertainty in ratings
- **Matchmaking**: Pair outputs with similar ratings more often
- **Recalculation job**: Ability to recalculate all ratings from scratch

