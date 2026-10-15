import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Read-only client for the PUBLIC website pages (server side, inside 'use cache').
// Cached code can't read cookies, so this client has no login: it sees exactly what a
// logged-out visitor sees (RLS: published content only). Never use it for writes.
export function createPublicClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
