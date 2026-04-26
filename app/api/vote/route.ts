import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';
import { votingRateLimit } from '@/lib/ratelimit';

export async function POST(request: Request) {
  try {
    // Get IP address for rate limiting
    const ip = (
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown'
    );

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

    // Record the vote and update ELO ratings in one database transaction.
    const supabaseServer = getSupabaseServer();
    const { data: voteData, error: voteError } = await supabaseServer.rpc(
      'record_vote',
      {
        p_output_a_id: output_a_id,
        p_output_b_id: output_b_id,
        p_winner_id: winner_id,
        p_voter_ip: ip,
      }
    );

    if (voteError) {
      console.error('Vote transaction error:', voteError);
      return NextResponse.json(
        { error: 'Failed to record vote' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true,
      elo_data: voteData 
    });
  } catch (error) {
    console.error('Error recording vote:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
