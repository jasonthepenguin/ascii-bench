-- Prompts table
CREATE TABLE prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id TEXT UNIQUE NOT NULL,
  prompt_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ASCII outputs table
CREATE TABLE ascii_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model TEXT NOT NULL,
  prompt_id UUID REFERENCES prompts(id) ON DELETE CASCADE,
  response_id TEXT,
  ascii_art TEXT NOT NULL,
  elo_rating INTEGER DEFAULT 1500,
  vote_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  model_config TEXT DEFAULT 'default',
  CONSTRAINT unique_prompt_model_config UNIQUE (prompt_id, model, model_config)
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
CREATE INDEX idx_ascii_outputs_model ON ascii_outputs(model);
CREATE INDEX idx_ascii_outputs_prompt_id ON ascii_outputs(prompt_id);
CREATE INDEX idx_ascii_outputs_elo ON ascii_outputs(elo_rating DESC);
CREATE INDEX idx_ascii_outputs_model_config ON ascii_outputs(model, model_config);
CREATE INDEX idx_votes_created_at ON votes(created_at DESC);

-- RLS Policies
ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ascii_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

-- Public can read everything
CREATE POLICY "Public read prompts" ON prompts FOR SELECT USING (true);
CREATE POLICY "Public read ascii_outputs" ON ascii_outputs FOR SELECT USING (true);
CREATE POLICY "Public read votes" ON votes FOR SELECT USING (true);

-- Public can insert votes (for anonymous voting)
CREATE POLICY "Public insert votes" ON votes FOR INSERT WITH CHECK (true);

-- Only authenticated users can insert/update outputs and prompts
CREATE POLICY "Authenticated insert prompts" ON prompts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated insert outputs" ON ascii_outputs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update outputs" ON ascii_outputs FOR UPDATE TO authenticated USING (true);

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
CREATE OR REPLACE FUNCTION update_elo_ratings(
  p_winner_id UUID,
  p_loser_id UUID
)
RETURNS TABLE(winner_new_elo INTEGER, loser_new_elo INTEGER) AS $$
DECLARE
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
  -- Get current ratings and vote counts with row-level locks
  -- FOR UPDATE ensures no other transaction can modify these rows until we're done
  SELECT elo_rating, vote_count INTO winner_elo, winner_votes
  FROM ascii_outputs WHERE id = p_winner_id FOR UPDATE;
  
  SELECT elo_rating, vote_count INTO loser_elo, loser_votes
  FROM ascii_outputs WHERE id = p_loser_id FOR UPDATE;
  
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
  
  -- Update both outputs
  UPDATE ascii_outputs
  SET 
    elo_rating = new_winner_elo,
    vote_count = vote_count + 1
  WHERE id = p_winner_id;
  
  UPDATE ascii_outputs
  SET 
    elo_rating = new_loser_elo,
    vote_count = vote_count + 1
  WHERE id = p_loser_id;
  
  -- Return new ratings
  RETURN QUERY SELECT new_winner_elo, new_loser_elo;
END;
$$ LANGUAGE plpgsql;