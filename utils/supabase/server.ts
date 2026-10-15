import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Supabase client for Server Components, Route Handlers and Server Actions.
// It reads the logged-in user's session from the request cookies.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Components can't set cookies, so this throws there.
            // That's fine: proxy.ts refreshes the session cookies on every request.
          }
        },
      },
    }
  );
}
