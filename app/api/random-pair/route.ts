import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    // Step 1: Get only prompt IDs to minimize data transfer
    const { data: allPrompts, error: promptError } = await supabase
      .from('prompts')
      .select('id');

    if (promptError || !allPrompts || allPrompts.length === 0) {
      return NextResponse.json(
        { error: 'No prompts found' },
        { status: 404 }
      );
    }

    // Step 2: Pick random prompt (client-side is fine for small datasets)
    const randomPrompt = allPrompts[Math.floor(Math.random() * allPrompts.length)];

    // Step 3: Get the full prompt details
    const { data: selectedPrompt, error: promptDetailError } = await supabase
      .from('prompts')
      .select('*')
      .eq('id', randomPrompt.id)
      .single();

    if (promptDetailError || !selectedPrompt) {
      return NextResponse.json(
        { error: 'Error fetching prompt' },
        { status: 500 }
      );
    }

    // Step 4: Get outputs for this prompt with model info
    const { data: outputs, error: outputsError } = await supabase
      .from('ascii_outputs')
      .select(`
        *,
        models:model_id (
          model_name,
          model_config,
          elo_rating,
          vote_count,
          metadata
        )
      `)
      .eq('prompt_id', selectedPrompt.id);

    if (outputsError || !outputs || outputs.length < 2) {
      return NextResponse.json(
        { error: 'Not enough outputs for this prompt' },
        { status: 404 }
      );
    }

    // Step 5: Properly shuffle using Fisher-Yates algorithm
    const shuffled = [...outputs];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const outputA = shuffled[0];
    const outputB = shuffled[1];

    return NextResponse.json({
      prompt: selectedPrompt,
      outputA,
      outputB,
    });
  } catch (error) {
    console.error('Error fetching random pair:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
