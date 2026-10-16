// Helpers for the sign-up / login pages and the auth callback.

// Sanitizes the `next` redirect target for /auth/callback: returns `next` only
// when it resolves to a same-origin URL, else a safe default. The string checks
// alone are not enough — URL parsing treats "\" as a separator and strips
// tabs/newlines, so "/\evil.com" and "/<tab>/evil.com" would slip through and
// land off-site. Comparing the resolved origin catches every parser quirk.
export function safeNextPath(next: string | null, origin: string, fallback = '/dashboard') {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return fallback;
  try {
    return new URL(next, origin).origin === origin ? next : fallback;
  } catch {
    return fallback;
  }
}

// Where the "confirm your email" link goes: /auth/callback logs the user in from the
// link, then opens the login page, which says the email is confirmed (or goes on to
// the dashboard when the login worked).
export function confirmEmailRedirect() {
  const next = encodeURIComponent('/auth/login?confirmed=1')
  return `${window.location.origin}/auth/callback?next=${next}`
}

// True when Supabase refused a login because the email isn't confirmed yet
export function isEmailNotConfirmed(err: unknown) {
  if (!err || typeof err !== 'object') return false
  const { code, message } = err as { code?: string; message?: string }
  return code === 'email_not_confirmed' || /email not confirmed/i.test(message ?? '')
}
