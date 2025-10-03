import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { output_a_id, output_b_id, winner_id } = body;

    // Validate input
    if (!output_a_id || !output_b_id || !winner_id) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Ensure winner_id is either output_a_id or output_b_id
    if (winner_id !== output_a_id && winner_id !== output_b_id) {
      return NextResponse.json(
        { error: 'Invalid winner_id' },
        { status: 400 }
      );
    }

    // Record the vote
    const { error } = await supabase.from('votes').insert({
      output_a_id,
      output_b_id,
      winner_id,
    });

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to record vote' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error recording vote:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
