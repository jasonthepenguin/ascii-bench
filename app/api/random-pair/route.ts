import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    // Get random prompt
    const { data: prompts, error: promptError } = await supabase
      .from('prompts')
      .select('*')
      .limit(1)
      .order('created_at', { ascending: false });

    if (promptError || !prompts || prompts.length === 0) {
      return NextResponse.json(
        { error: 'No prompts found' },
        { status: 404 }
      );
    }

    const selectedPrompt = prompts[0];

    // Get two random outputs for this prompt
    const { data: outputs, error: outputsError } = await supabase
      .from('ascii_outputs')
      .select('*')
      .eq('prompt_id', selectedPrompt.id);

    if (outputsError || !outputs || outputs.length < 2) {
      return NextResponse.json(
        { error: 'Not enough outputs for this prompt' },
        { status: 404 }
      );
    }

    // Randomly select two different outputs
    const shuffled = outputs.sort(() => 0.5 - Math.random());
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
