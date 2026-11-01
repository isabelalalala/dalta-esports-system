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

// Full page load to `path`, for every place where the login state just changed (log in, log out,
// privacy consent, terms, password change). proxy.ts decides where a user may go, and the client
// router keeps pages it prefetched earlier: /dashboard prefetched while logged out is cached as
// "redirect to /auth/login", so router.push('/dashboard') after logging in would land on the login
// page again. A full load asks the server again with the new cookies and clears that cache.
export function reloadTo(path: string) {
  window.location.assign(path)
}

// --- Email sending limits ---------------------------------------------------
// Supabase refuses to send an auth email (sign-up confirmation, resend, password reset) when
// a limit is reached, with the code over_email_send_rate_limit (HTTP 429). Two limits:
// - the project-wide "emails per hour" (Authentication > Rate Limits; tiny without custom SMTP)
// - the minimum gap between emails to the same address: "...only request this after 37 seconds."
// When Supabase refuses, nothing is sent and (for sign-up) the account isn't created, so the
// same request can simply be tried again later.

// How long the "Resend" / "Try again" buttons wait (matches Supabase's per-address gap)
export const EMAIL_COOLDOWN_SECONDS = 60

type AuthErrorLike = { code?: string; status?: number; message?: string }

export function isEmailRateLimited(err: unknown) {
  if (!err || typeof err !== 'object') return false
  const { code, status, message } = err as AuthErrorLike
  return code === 'over_email_send_rate_limit' || (status === 429 && /email/i.test(message ?? ''))
}

// Seconds to wait before trying again: what Supabase says ("after 37 seconds"), else the default
export function emailRetryDelay(err: unknown) {
  const message = err && typeof err === 'object' ? (err as AuthErrorLike).message ?? '' : ''
  const match = /after (\d+) seconds?/i.exec(message)
  return match ? Math.max(1, Number(match[1])) : EMAIL_COOLDOWN_SECONDS
}

// A plain explanation for the person, who usually did nothing wrong
export function emailRateLimitMessage(err: unknown, action: 'signup' | 'resend' | 'reset') {
  const message = err && typeof err === 'object' ? (err as AuthErrorLike).message ?? '' : ''
  if (/after \d+ seconds?/i.test(message)) {
    return `We just sent you an email. You can ask for another one in ${emailRetryDelay(err)} seconds.`
  }
  const what = action === 'signup' ? 'Your account was not created yet.' : 'Nothing was sent.'
  return `Our email service is busy because many people are signing up right now. ${what} Please try again in a minute.`
}

// Email format check for the auth forms. Stricter than the browser's type="email",
// which accepts "juan@gmail" (no dot in the domain). Requires name@domain.tld with
// a 2+ letter ending, no spaces, and no dots at the start, end or twice in a row.
const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/

export function isValidEmail(value: string) {
  const email = value.trim()
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) return false
  const local = email.split('@')[0]
  return !local.startsWith('.') && !local.endsWith('.') && !local.includes('..')
}

// The message shown under an email field, or '' when the email is fine
export function getEmailError(value: string) {
  if (!value.trim()) return 'Enter your email.'
  return isValidEmail(value) ? '' : 'Enter a valid email address, e.g. juan@gmail.com.'
}
