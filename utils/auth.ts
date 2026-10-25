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
