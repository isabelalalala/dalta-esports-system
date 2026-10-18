import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { PRIVACY_NOTICE_VERSION } from './utils/privacy';
import { TOS_VERSION } from './utils/terms';

// Pages that require a logged-in user.
// [^/]+ matches a tournament id, e.g. /tournaments/123/edit
const protectedRoutes = [
  /^\/dashboard(\/.*)?$/,
  /^\/teams(\/.*)?$/,
  /^\/profile(\/.*)?$/,
  /^\/tournaments\/create$/,
  /^\/tournaments\/[^/]+\/(edit|registrations|matches|streams|predictions)$/,
  /^\/matches(\/.*)?$/,
  /^\/admin(\/.*)?$/,
  /^\/registrations(\/.*)?$/,
  /^\/announcements(\/.*)?$/,
  /^\/schedule(\/.*)?$/,
  /^\/live(\/.*)?$/,
  /^\/feedback(\/.*)?$/,
  /^\/analytics(\/.*)?$/,
  /^\/notifications$/,
  // /privacy itself is public; only the consent form needs a login
  /^\/privacy\/consent$/,
  // /terms is public; only the accept form needs a login
  /^\/terms\/accept$/,
];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const path = request.nextUrl.pathname;
  const isProtected = protectedRoutes.some((route) => route.test(path));
  const hasAuthCookie = request.cookies.getAll().some((c) => c.name.startsWith('sb-'));

  // No Supabase cookie means there is no session to verify or refresh — skip the
  // remote getUser() round-trip. Protected pages go straight to login.
  if (!hasAuthCookie) {
    if (isProtected) {
      return NextResponse.redirect(new URL('/auth/login', request.url));
    }
    return response;
  }

  // Route handlers verify the session themselves; refreshing it here too would
  // make every API call pay for two getUser() round-trips.
  if (path.startsWith('/api/')) {
    return response;
  }

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

  if (!user && isProtected) {
    const redirect = NextResponse.redirect(new URL('/auth/login', request.url));
    // Keep any refreshed/cleared session cookies on the redirect response.
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  // Logged-in users on protected pages must have agreed to the current Privacy
  // Notice and Terms of Service versions — otherwise they are sent to re-consent
  // before the app can collect more of their data. The consent/accept pages are
  // exempt to avoid a loop.
  if (user && isProtected && path !== '/privacy/consent' && path !== '/terms/accept') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('privacy_consent_version, tos_version')
      .eq('id', user.id)
      .maybeSingle();
    const needed =
      profile?.privacy_consent_version !== PRIVACY_NOTICE_VERSION
        ? '/privacy/consent'
        : profile?.tos_version !== TOS_VERSION
          ? '/terms/accept'
          : null;
    if (needed) {
      const redirect = NextResponse.redirect(new URL(needed, request.url));
      response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
      return redirect;
    }
  }

  return response;
}

export const config = {
  // Run on every page so the session stays fresh, but skip static files and images.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt)$).*)'],
};
