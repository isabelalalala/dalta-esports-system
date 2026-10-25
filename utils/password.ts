// Password rules for every form that sets a new password: register, reset password,
// change password on /profile and the admin's "Add account".
// The app checks these so people see what's wrong while typing. The real enforcement is
// the Supabase setting (Authentication → Sign In / Providers → Email: minimum length 10,
// lowercase + uppercase + digits + symbols), because the browser checks can be skipped.

export const PASSWORD_MIN_LENGTH = 10;

// Words people often build passwords from. A password is refused when its letters,
// with numbers and symbols removed, are one of these ("Password123!" → "password").
const COMMON_WORDS = [
  'password', 'passw', 'qwerty', 'qwertyuiop', 'asdf', 'asdfgh', 'asdfghjkl', 'zxcvbn',
  'abc', 'abcd', 'abcdef', 'abcdefg', 'letmein', 'welcome', 'admin', 'administrator',
  'iloveyou', 'monkey', 'dragon', 'sunshine', 'princess', 'football', 'basketball',
  'changeme', 'secret', 'login', 'user', 'test', 'dalta', 'daltaesports', 'esports',
  'uphsd', 'perpetual', 'mlbb', 'valorant', 'tekken', 'codm',
];

// Who the password belongs to, so it can't just be their own name or email
export interface PasswordContext {
  email?: string;
  fullName?: string;
}

export interface PasswordCheck {
  label: string;
  ok: boolean;
}

// Parts of the email and name worth checking (3+ letters, so "Jo" doesn't block everything)
function personalParts({ email, fullName }: PasswordContext) {
  const local = (email ?? '').trim().toLowerCase().split('@')[0] ?? '';
  const names = (fullName ?? '').toLowerCase().split(/\s+/);
  return [local, ...names].filter((part) => part.length >= 3);
}

// One entry per rule, in the order the checklist shows them
export function getPasswordChecks(password: string, context: PasswordContext = {}): PasswordCheck[] {
  const lower = password.toLowerCase();
  const letters = lower.replace(/[^a-z]/g, '');
  return [
    { label: `At least ${PASSWORD_MIN_LENGTH} characters`, ok: password.length >= PASSWORD_MIN_LENGTH },
    { label: 'An uppercase letter (A-Z)', ok: /[A-Z]/.test(password) },
    { label: 'A lowercase letter (a-z)', ok: /[a-z]/.test(password) },
    { label: 'A number (0-9)', ok: /[0-9]/.test(password) },
    // Anything that isn't a letter, number or space counts as a symbol
    { label: 'A symbol (e.g. ! @ # $ %)', ok: /[^A-Za-z0-9\s]/.test(password) },
    {
      label: 'Not a common password or your name or email',
      ok:
        password.length > 0 &&
        !COMMON_WORDS.includes(letters) &&
        !personalParts(context).some((part) => lower.includes(part)),
    },
  ];
}

// The first rule the password breaks as a sentence, or null when it's fine
export function getPasswordError(password: string, context: PasswordContext = {}): string | null {
  const failed = getPasswordChecks(password, context).find((check) => !check.ok);
  if (!failed) return null;
  if (failed.label.startsWith('Not a common')) {
    return "This password is too easy to guess. Don't use a common password, your name or your email.";
  }
  return `The password needs: ${failed.label.charAt(0).toLowerCase()}${failed.label.slice(1)}.`;
}

export type PasswordStrength = 'weak' | 'fair' | 'strong';

// For the strength bar: all rules met = at least fair; longer passwords are strong
export function getPasswordStrength(password: string, context: PasswordContext = {}): PasswordStrength {
  const passed = getPasswordChecks(password, context).filter((check) => check.ok).length;
  if (passed < 6) return 'weak';
  return password.length >= 14 ? 'strong' : 'fair';
}
