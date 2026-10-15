// Helpers for the sign-up / login pages (browser only: they use window).

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
