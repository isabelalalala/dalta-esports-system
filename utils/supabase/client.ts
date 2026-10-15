import { createBrowserClient } from '@supabase/ssr';

// Supabase client for Client Components ("use client").
// The session is stored in cookies so the server and proxy.ts can read it too.
// In the browser this always returns the same instance, so it's safe in useEffect dependency arrays.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
