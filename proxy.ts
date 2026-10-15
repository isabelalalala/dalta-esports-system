import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Pages that require a logged-in user.
// [^/]+ matches a tournament id, e.g. /tournaments/123/edit
const protectedRoutes = [
  /^\/dashboard(\/.*)?$/,
  /^\/tournaments\/create$/,
  /^\/tournaments\/[^/]+\/(edit|registrations)$/,
];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        // When Supabase refreshes the session, write the new cookies to both
        // the request (so pages rendered now see them) and the response (so the browser stores them).
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() checks the session with Supabase Auth and refreshes it if it expired.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isProtected = protectedRoutes.some((route) => route.test(path));

  if (!user && isProtected) {
    const redirect = NextResponse.redirect(new URL('/auth/login', request.url));
    // Keep any refreshed/cleared session cookies on the redirect response.
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  return response;
}

export const config = {
  // Run on every page so the session stays fresh, but skip static files and images.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
