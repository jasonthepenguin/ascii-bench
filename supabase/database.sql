-- Prompts table
CREATE TABLE prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id TEXT UNIQUE NOT NULL,
  prompt_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Models table (stores ELO ratings at model level)
CREATE TABLE models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_name TEXT NOT NULL,
  model_config TEXT DEFAULT 'default',
  elo_rating INTEGER DEFAULT 1500,
  vote_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_model_config UNIQUE (model_name, model_config)
);

-- ASCII outputs table (just stores the outputs, references models for ELO)
CREATE TABLE ascii_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID REFERENCES models(id) ON DELETE CASCADE,
  prompt_id UUID REFERENCES prompts(id) ON DELETE CASCADE,
  response_id TEXT,
  ascii_art TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_prompt_model UNIQUE (prompt_id, model_id)
);

-- Votes table
CREATE TABLE votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  output_a_id UUID NOT NULL REFERENCES ascii_outputs(id) ON DELETE CASCADE,
  output_b_id UUID NOT NULL REFERENCES ascii_outputs(id) ON DELETE CASCADE,
  winner_id UUID NOT NULL REFERENCES ascii_outputs(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  voter_ip TEXT,
  CONSTRAINT winner_must_be_a_or_b CHECK (winner_id = output_a_id OR winner_id = output_b_id)
);

-- Indexes for performance
CREATE INDEX idx_models_elo ON models(elo_rating DESC);
CREATE INDEX idx_models_name ON models(model_name);
CREATE INDEX idx_ascii_outputs_model_id ON ascii_outputs(model_id);
CREATE INDEX idx_ascii_outputs_prompt_id ON ascii_outputs(prompt_id);
CREATE INDEX idx_votes_created_at ON votes(created_at DESC);

-- RLS Policies
ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE models ENABLE ROW LEVEL SECURITY;
ALTER TABLE ascii_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

-- Public can read everything
CREATE POLICY "Public read prompts" ON prompts FOR SELECT USING (true);
CREATE POLICY "Public read models" ON models FOR SELECT USING (true);
CREATE POLICY "Public read ascii_outputs" ON ascii_outputs FOR SELECT USING (true);
CREATE POLICY "Public read votes" ON votes FOR SELECT USING (true);

-- Votes can only be inserted via server-side API (using secret key)
-- No public insert policy - anon cannot insert directly

-- Only authenticated users can insert/update
CREATE POLICY "Authenticated insert prompts" ON prompts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated insert models" ON models FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update models" ON models FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated insert outputs" ON ascii_outputs FOR INSERT TO authenticated WITH CHECK (true);

-- Function to calculate dynamic K-factor based on vote count
-- Higher K for new outputs (more volatile), lower K for established outputs (more stable)
CREATE OR REPLACE FUNCTION calculate_k_factor(vote_count INTEGER)
RETURNS NUMERIC AS $$
DECLARE
  base_k NUMERIC := 32.0;  -- Starting K-factor for new outputs
  min_k NUMERIC := 10.0;    -- Minimum K-factor for well-established outputs
  decay_divisor NUMERIC := 30.0; -- Controls how quickly K decreases
  k_factor NUMERIC;
BEGIN
  k_factor := base_k / (1.0 + vote_count / decay_divisor);
  -- Ensure K doesn't go below minimum
  RETURN GREATEST(k_factor, min_k);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to update ELO ratings after a vote
-- Uses dynamic K-factor for adaptive rating stability
-- Now updates MODEL ratings, not individual output ratings
-- SECURITY DEFINER allows anonymous users to call this function with elevated privileges
CREATE OR REPLACE FUNCTION update_elo_ratings(
  p_winner_output_id UUID,
  p_loser_output_id UUID
)
RETURNS TABLE(winner_new_elo INTEGER, loser_new_elo INTEGER) 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  winner_model_id UUID;
  loser_model_id UUID;
  winner_elo INTEGER;
  loser_elo INTEGER;
  winner_votes INTEGER;
  loser_votes INTEGER;
  winner_k NUMERIC;
  loser_k NUMERIC;
  expected_winner NUMERIC;
  expected_loser NUMERIC;
  new_winner_elo INTEGER;
  new_loser_elo INTEGER;
BEGIN
  -- Get model IDs from the outputs
  SELECT model_id INTO winner_model_id
  FROM ascii_outputs WHERE id = p_winner_output_id;
  
  SELECT model_id INTO loser_model_id
  FROM ascii_outputs WHERE id = p_loser_output_id;
  
  -- Get current ratings and vote counts from models table with row-level locks
  -- FOR UPDATE ensures no other transaction can modify these rows until we're done
  SELECT elo_rating, vote_count INTO winner_elo, winner_votes
  FROM models WHERE id = winner_model_id FOR UPDATE;
  
  SELECT elo_rating, vote_count INTO loser_elo, loser_votes
  FROM models WHERE id = loser_model_id FOR UPDATE;
  
  -- Calculate dynamic K-factors
  winner_k := calculate_k_factor(winner_votes);
  loser_k := calculate_k_factor(loser_votes);
  
  -- Calculate expected scores (probability of winning)
  expected_winner := 1.0 / (1.0 + POWER(10.0, (loser_elo - winner_elo) / 400.0));
  expected_loser := 1.0 / (1.0 + POWER(10.0, (winner_elo - loser_elo) / 400.0));
  
  -- Calculate new ratings
  -- Winner gets actual score of 1 (won), expected was expected_winner
  new_winner_elo := winner_elo + ROUND(winner_k * (1.0 - expected_winner));
  -- Loser gets actual score of 0 (lost), expected was expected_loser
  new_loser_elo := loser_elo + ROUND(loser_k * (0.0 - expected_loser));
  
  -- Update both models
  UPDATE models
  SET 
    elo_rating = new_winner_elo,
    vote_count = vote_count + 1
  WHERE id = winner_model_id;
  
  UPDATE models
  SET 
    elo_rating = new_loser_elo,
    vote_count = vote_count + 1
  WHERE id = loser_model_id;
  
  -- Return new ratings
  RETURN QUERY SELECT new_winner_elo, new_loser_elo;
END;
$$ LANGUAGE plpgsql;

-- Function to reset all ELO ratings and votes (for testing)
-- WARNING: This deletes all votes and resets all model ratings to 1500
CREATE OR REPLACE FUNCTION reset_elo_system()
RETURNS TABLE(models_reset INTEGER, votes_deleted INTEGER) 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_models_reset INTEGER;
  v_votes_deleted INTEGER;
BEGIN
  -- Delete all votes
  DELETE FROM votes;
  GET DIAGNOSTICS v_votes_deleted = ROW_COUNT;
  
  -- Reset all model ratings and vote counts
  UPDATE models
  SET 
    elo_rating = 1500,
    vote_count = 0;
  GET DIAGNOSTICS v_models_reset = ROW_COUNT;
  
  -- Return counts
  RETURN QUERY SELECT v_models_reset, v_votes_deleted;
END;
$$ LANGUAGE plpgsql;

-- Security: Revoke anon write access (votes go through server-side API only)
REVOKE INSERT ON votes FROM anon;
REVOKE EXECUTE ON FUNCTION update_elo_ratings FROM anon;