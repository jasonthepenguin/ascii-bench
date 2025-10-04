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

    // Determine loser_id
    const loser_id = winner_id === output_a_id ? output_b_id : output_a_id;

    // Update ELO ratings using the database function
    const { data: eloData, error: eloError } = await supabase.rpc(
      'update_elo_ratings',
      {
        p_winner_id: winner_id,
        p_loser_id: loser_id,
      }
    );

    if (eloError) {
      console.error('ELO update error:', eloError);
      return NextResponse.json(
        { error: 'Failed to update ratings' },
        { status: 500 }
      );
    }

    // Record the vote
    const { error: voteError } = await supabase.from('votes').insert({
      output_a_id,
      output_b_id,
      winner_id,
    });

    if (voteError) {
      console.error('Vote recording error:', voteError);
      // Note: ELO has already been updated at this point
      // In production, you might want to use a database transaction
      return NextResponse.json(
        { error: 'Failed to record vote' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true,
      elo_data: eloData 
    });
  } catch (error) {
    console.error('Error recording vote:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
