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