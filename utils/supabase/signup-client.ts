import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// A one-off Supabase client for creating accounts on behalf of someone else
// (admin "Add account"). It keeps the new user's session in memory only and
// throws it away, so the admin's own login (stored in cookies by
// utils/supabase/client.ts) is not replaced.
//
// flowType 'implicit': the confirmation email link must work in the new user's
// own browser. The default PKCE flow would need a secret saved in the admin's browser.
export function createSignupClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        flowType: 'implicit',
      },
    }
  );
}
