import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    // Step 1: Build the candidate prompt list from outputs so every
    // selected prompt can actually produce a pair.
    const { data: outputPromptRefs, error: promptRefsError } = await supabase
      .from('ascii_outputs')
      .select('prompt_id');

    if (promptRefsError || !outputPromptRefs || outputPromptRefs.length === 0) {
      return NextResponse.json(
        { error: 'No outputs found' },
        { status: 404 }
      );
    }

    const outputCountsByPrompt = outputPromptRefs.reduce<Record<string, number>>((counts, row) => {
      if (row.prompt_id) {
        counts[row.prompt_id] = (counts[row.prompt_id] || 0) + 1;
      }
      return counts;
    }, {});

    const eligiblePromptIds = Object.entries(outputCountsByPrompt)
      .filter(([, outputCount]) => outputCount >= 2)
      .map(([promptId]) => promptId);

    if (eligiblePromptIds.length === 0) {
      return NextResponse.json(
        { error: 'No prompts with enough outputs found' },
        { status: 404 }
      );
    }

    // Step 2: Pick random eligible prompt (client-side is fine for small datasets)
    const randomPromptId = eligiblePromptIds[Math.floor(Math.random() * eligiblePromptIds.length)];

    // Step 3: Get the full prompt details
    const { data: selectedPrompt, error: promptDetailError } = await supabase
      .from('prompts')
      .select('*')
      .eq('id', randomPromptId)
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
