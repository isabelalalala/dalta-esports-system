// Gets a readable message from anything thrown in a try/catch.
// Supabase errors are objects with a `message` (and often a `code`), but not always `Error` instances.
//
// Our own database rules (triggers and functions) already raise readable messages, so those are
// shown as they are. Raw Postgres / PostgREST / network messages ("new row violates row-level
// security policy for table ...") are replaced with plain sentences.
export function getErrorMessage(err: unknown, fallback: string) {
  if (!err || typeof err !== 'object' || !('message' in err) || typeof err.message !== 'string') {
    return fallback;
  }
  const message = err.message;
  const code = 'code' in err && typeof err.code === 'string' ? err.code : '';

  // Network: the browser couldn't reach Supabase or our server
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(message)) {
    return "Can't reach the server. Check your internet connection and try again.";
  }
  // Supabase Auth couldn't hand an email (confirmation, reset, password changed) to the mail server.
  // The reason is in Supabase → Logs → Auth; usually the SMTP settings (Brevo) are wrong.
  if (/error sending .*email/i.test(message)) {
    return "We couldn't send the email right now. Please try again in a few minutes. If it keeps happening, contact the organizers.";
  }
  // Logged out in another tab, or the session is too old
  if (code === 'PGRST301' || code === 'PGRST303' || /jwt expired|invalid jwt|refresh token/i.test(message)) {
    return 'Your session has expired. Please log in again.';
  }
  // RLS or missing grants
  if (code === '42501' || /row-level security|permission denied/i.test(message)) {
    return "You don't have permission to do that. If you think you should, ask an organizer.";
  }
  // .single() found nothing
  if (code === 'PGRST116') {
    return 'Not found. It may have been deleted.';
  }
  switch (code) {
    // Supabase Auth (login, sign-up, password changes)
    case 'invalid_credentials': return 'Wrong email or password.';
    case 'over_request_rate_limit': return 'Too many attempts. Please wait a few minutes and try again.';
    case 'over_email_send_rate_limit': return 'Too many emails are being sent right now. Please wait a minute and try again.';
    case 'weak_password': return 'This password is too weak. Use at least 10 characters with uppercase and lowercase letters, a number and a symbol.';
    case 'email_address_invalid': return "This email address can't be used. Please check it or use another one.";
    case 'same_password': return 'The new password must be different from your current one.';
    case '23505': return 'This already exists. Check the list for the same name or entry.';
    case '23503': return "This is still used elsewhere (for example by a team, match or registration), so it can't be changed or deleted yet.";
    case '23514':
    case '23502': return "Some values aren't allowed. Please check the form and try again.";
    case '22P02': return 'This link or value is not valid.';
    case '22001': return 'One of the texts is too long.';
    case '57014': return 'The server took too long. Please try again.';
  }
  // Internal database errors (SQL syntax / unknown column or function: 42xxx, connection: 08xxx,
  // resources: 53xxx, system: 58xxx/XXxxx, PostgREST schema cache: PGRST2xx) name tables, columns
  // and functions. Never show those; our own trigger messages (P0001) and auth messages pass through.
  if (/^(42|08|53|58|XX|PGRST2)/.test(code)) {
    return 'Something went wrong on our side. Please try again, or tell an organizer if it keeps happening.';
  }
  return message || fallback;
}
