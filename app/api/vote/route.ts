import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { votingRateLimit } from '@/lib/ratelimit';

export async function POST(request: Request) {
  try {
    // Get IP address for rate limiting
    const ip = request.headers.get('x-forwarded-for') ||
               request.headers.get('x-real-ip') ||
               'unknown';

    // Check rate limit
    const { success, limit, reset, remaining } = await votingRateLimit.limit(ip);

    if (!success) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded. Please try again later.',
          limit,
          reset: new Date(reset).toISOString(),
          remaining
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': remaining.toString(),
            'X-RateLimit-Reset': reset.toString(),
          }
        }
      );
    }

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
        p_winner_output_id: winner_id,
        p_loser_output_id: loser_id,
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
