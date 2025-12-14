import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Public client for frontend reads
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server-side client with secret key for writes (never use on client)
let _supabaseServer: SupabaseClient | null = null;

export function getSupabaseServer(): SupabaseClient {
  if (!_supabaseServer) {
    _supabaseServer = createClient(
      supabaseUrl,
      process.env.SUPABASE_SECRET_KEY!
    );
  }
  return _supabaseServer;
}
