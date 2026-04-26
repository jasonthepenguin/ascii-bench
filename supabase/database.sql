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

-- Private schema for implementation details and privileged maintenance helpers.
-- Do not expose this schema through Supabase's Data API.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO service_role;

-- Function to calculate dynamic K-factor based on vote count
-- Higher K for new models (more volatile), lower K for established models (more stable)
CREATE OR REPLACE FUNCTION private.calculate_k_factor(vote_count INTEGER)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  base_k NUMERIC := 32.0;  -- Starting K-factor for new models
  min_k NUMERIC := 10.0;    -- Minimum K-factor for well-established models
  decay_divisor NUMERIC := 30.0; -- Controls how quickly K decreases
  k_factor NUMERIC;
BEGIN
  k_factor := base_k / (1.0 + vote_count / decay_divisor);
  -- Ensure K doesn't go below minimum
  RETURN GREATEST(k_factor, min_k);
END;
$$;

-- Records a vote and updates model-level ELO ratings in one transaction.
-- Keep the privileged implementation private and expose it through a small
-- public wrapper that is granted only to the server-side service role.
CREATE OR REPLACE FUNCTION private.record_vote_impl(
  p_output_a_id UUID,
  p_output_b_id UUID,
  p_winner_id UUID,
  p_voter_ip TEXT DEFAULT NULL
)
RETURNS TABLE(winner_new_elo INTEGER, loser_new_elo INTEGER, vote_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  loser_id UUID;
  winner_model_id UUID;
  loser_model_id UUID;
  winner_prompt_id UUID;
  loser_prompt_id UUID;
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
  new_vote_id UUID;
  model_row RECORD;
BEGIN
  IF p_output_a_id IS NULL OR p_output_b_id IS NULL OR p_winner_id IS NULL THEN
    RAISE EXCEPTION 'Vote output IDs are required' USING ERRCODE = '23502';
  END IF;

  IF p_output_a_id = p_output_b_id THEN
    RAISE EXCEPTION 'Compared outputs must be different' USING ERRCODE = '23514';
  END IF;

  IF p_winner_id <> p_output_a_id AND p_winner_id <> p_output_b_id THEN
    RAISE EXCEPTION 'winner_id must match one of the compared outputs' USING ERRCODE = '23514';
  END IF;

  loser_id := CASE
    WHEN p_winner_id = p_output_a_id THEN p_output_b_id
    ELSE p_output_a_id
  END;

  -- Get model and prompt IDs from the outputs.
  SELECT model_id, prompt_id INTO winner_model_id, winner_prompt_id
  FROM public.ascii_outputs
  WHERE id = p_winner_id;

  SELECT model_id, prompt_id INTO loser_model_id, loser_prompt_id
  FROM public.ascii_outputs
  WHERE id = loser_id;

  IF winner_model_id IS NULL OR loser_model_id IS NULL THEN
    RAISE EXCEPTION 'Compared output not found' USING ERRCODE = '23503';
  END IF;

  IF winner_model_id = loser_model_id THEN
    RAISE EXCEPTION 'Compared outputs must belong to different models' USING ERRCODE = '23514';
  END IF;

  IF winner_prompt_id <> loser_prompt_id THEN
    RAISE EXCEPTION 'Compared outputs must belong to the same prompt' USING ERRCODE = '23514';
  END IF;

  -- Lock model rows in deterministic order to avoid deadlocks on simultaneous inverse votes.
  FOR model_row IN
    SELECT id, elo_rating, vote_count
    FROM public.models
    WHERE id IN (winner_model_id, loser_model_id)
    ORDER BY id
    FOR UPDATE
  LOOP
    IF model_row.id = winner_model_id THEN
      winner_elo := model_row.elo_rating;
      winner_votes := model_row.vote_count;
    ELSIF model_row.id = loser_model_id THEN
      loser_elo := model_row.elo_rating;
      loser_votes := model_row.vote_count;
    END IF;
  END LOOP;

  IF winner_elo IS NULL OR loser_elo IS NULL THEN
    RAISE EXCEPTION 'Compared model not found' USING ERRCODE = '23503';
  END IF;

  -- Calculate dynamic K-factors
  winner_k := private.calculate_k_factor(winner_votes);
  loser_k := private.calculate_k_factor(loser_votes);

  -- Calculate expected scores (probability of winning)
  expected_winner := 1.0 / (1.0 + POWER(10.0, (loser_elo - winner_elo) / 400.0));
  expected_loser := 1.0 / (1.0 + POWER(10.0, (winner_elo - loser_elo) / 400.0));

  -- Calculate new ratings
  new_winner_elo := winner_elo + ROUND(winner_k * (1.0 - expected_winner));
  new_loser_elo := loser_elo + ROUND(loser_k * (0.0 - expected_loser));

  -- Update both models
  UPDATE public.models
  SET
    elo_rating = new_winner_elo,
    vote_count = vote_count + 1
  WHERE id = winner_model_id;

  UPDATE public.models
  SET
    elo_rating = new_loser_elo,
    vote_count = vote_count + 1
  WHERE id = loser_model_id;

  -- Record the vote only after all validation and rating calculations pass.
  INSERT INTO public.votes (output_a_id, output_b_id, winner_id, voter_ip)
  VALUES (p_output_a_id, p_output_b_id, p_winner_id, p_voter_ip)
  RETURNING id INTO new_vote_id;

  RETURN QUERY SELECT new_winner_elo, new_loser_elo, new_vote_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_vote(
  p_output_a_id UUID,
  p_output_b_id UUID,
  p_winner_id UUID,
  p_voter_ip TEXT DEFAULT NULL
)
RETURNS TABLE(winner_new_elo INTEGER, loser_new_elo INTEGER, vote_id UUID)
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT *
  FROM private.record_vote_impl(p_output_a_id, p_output_b_id, p_winner_id, p_voter_ip);
$$;

-- Function to reset all ELO ratings and votes (for testing)
-- WARNING: This deletes all votes and resets all model ratings to 1500.
-- Keep it in the private schema and run it only from trusted database tooling.
CREATE OR REPLACE FUNCTION private.reset_elo_system()
RETURNS TABLE(models_reset INTEGER, votes_deleted INTEGER)
LANGUAGE plpgsql
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
$$;

-- Remove older exposed helper functions if this SQL is applied to an existing project.
DROP FUNCTION IF EXISTS public.update_elo_ratings(UUID, UUID);
DROP FUNCTION IF EXISTS public.reset_elo_system();

-- Security: write access goes through the trusted server API only.
DROP POLICY IF EXISTS "Public insert votes" ON votes;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON votes FROM anon, authenticated;
REVOKE ALL ON FUNCTION private.calculate_k_factor(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.calculate_k_factor(INTEGER) TO service_role;
REVOKE ALL ON FUNCTION private.record_vote_impl(UUID, UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.record_vote_impl(UUID, UUID, UUID, TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.record_vote(UUID, UUID, UUID, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_vote(UUID, UUID, UUID, TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_vote(UUID, UUID, UUID, TEXT) TO service_role;
REVOKE ALL ON FUNCTION private.reset_elo_system() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.reset_elo_system() TO service_role;