import { describe, expect, it } from 'vitest';
import {
  EMAIL_COOLDOWN_SECONDS, emailRateLimitMessage, emailRetryDelay, getEmailError, isEmailRateLimited, isValidEmail, safeNextPath,
} from '@/utils/auth';

const ORIGIN = 'https://dalta-esports.vercel.app';

describe('safeNextPath', () => {
  it('keeps normal in-app paths, including query strings', () => {
    expect(safeNextPath('/dashboard', ORIGIN)).toBe('/dashboard');
    expect(safeNextPath('/auth/login?confirmed=1', ORIGIN)).toBe('/auth/login?confirmed=1');
    expect(safeNextPath('/tournaments/abc-123', ORIGIN)).toBe('/tournaments/abc-123');
  });
  it('falls back for missing or non-path values', () => {
    expect(safeNextPath(null, ORIGIN)).toBe('/dashboard');
    expect(safeNextPath('', ORIGIN)).toBe('/dashboard');
    expect(safeNextPath('dashboard', ORIGIN)).toBe('/dashboard');
    expect(safeNextPath('javascript:alert(1)', ORIGIN)).toBe('/dashboard');
  });
  it('rejects protocol-relative and absolute off-site URLs', () => {
    expect(safeNextPath('//evil.com', ORIGIN)).toBe('/dashboard');
    expect(safeNextPath('https://evil.com/x', ORIGIN)).toBe('/dashboard');
    expect(safeNextPath('http://evil.com', ORIGIN)).toBe('/dashboard');
  });
  it('rejects the backslash bypass — the parser treats it as a separator', () => {
    expect(safeNextPath('/\\evil.com', ORIGIN)).toBe('/dashboard');
    expect(safeNextPath('/\\/evil.com', ORIGIN)).toBe('/dashboard');
    expect(safeNextPath('\\evil.com', ORIGIN)).toBe('/dashboard');
    // "\" mid-path only becomes "/" — still same-origin, so it stays
    expect(safeNextPath('/path\\evil.com', ORIGIN)).toBe('/path\\evil.com');
  });
  it('rejects tab/newline injection — the parser strips them, producing "//evil.com"', () => {
    expect(safeNextPath('/\t/evil.com', ORIGIN)).toBe('/dashboard');
    expect(safeNextPath('/\n/evil.com', ORIGIN)).toBe('/dashboard');
    // a lone "\r" strips to a harmless same-origin path
    expect(safeNextPath('/\revil.com', ORIGIN)).toBe('/\revil.com');
  });
});

describe('isValidEmail / getEmailError', () => {
  it('accepts normal addresses', () => {
    expect(isValidEmail('juan@gmail.com')).toBe(true);
    expect(isValidEmail('maria.santos+dalta@perpetual.edu.ph')).toBe(true);
    expect(isValidEmail('  juan@gmail.com  ')).toBe(true);
  });
  it('rejects addresses the browser would let through or that are mistyped', () => {
    expect(isValidEmail('juan@gmail')).toBe(false);
    expect(isValidEmail('juan@gmail.c')).toBe(false);
    expect(isValidEmail('juangmail.com')).toBe(false);
    expect(isValidEmail('juan @gmail.com')).toBe(false);
    expect(isValidEmail('juan..cruz@gmail.com')).toBe(false);
    expect(isValidEmail('.juan@gmail.com')).toBe(false);
    expect(isValidEmail('juan@-gmail.com')).toBe(false);
    expect(isValidEmail('juan@gmail..com')).toBe(false);
  });
  it('explains empty and invalid emails', () => {
    expect(getEmailError('')).toBe('Enter your email.');
    expect(getEmailError('juan@gmail')).toMatch(/valid email/);
    expect(getEmailError('juan@gmail.com')).toBe('');
  });
});

// Shapes of the errors supabase-js throws (AuthApiError: message, status, code)
const projectLimit = { message: 'email rate limit exceeded', status: 429, code: 'over_email_send_rate_limit' };
const perAddressGap = {
  message: 'For security purposes, you can only request this after 37 seconds.',
  status: 429,
  code: 'over_email_send_rate_limit',
};

describe('email rate limits', () => {
  it('recognizes Supabase email limit errors', () => {
    expect(isEmailRateLimited(projectLimit)).toBe(true);
    expect(isEmailRateLimited(perAddressGap)).toBe(true);
    // older servers without an error code
    expect(isEmailRateLimited({ message: 'email rate limit exceeded', status: 429 })).toBe(true);
  });
  it('ignores other errors', () => {
    expect(isEmailRateLimited({ message: 'Invalid login credentials', status: 400, code: 'invalid_credentials' })).toBe(false);
    expect(isEmailRateLimited({ message: 'Too many requests', status: 429, code: 'over_request_rate_limit' })).toBe(false);
    expect(isEmailRateLimited(null)).toBe(false);
  });
  it('waits as long as Supabase says, else the default cooldown', () => {
    expect(emailRetryDelay(perAddressGap)).toBe(37);
    expect(emailRetryDelay(projectLimit)).toBe(EMAIL_COOLDOWN_SECONDS);
  });
  it('explains the limit without blaming the person', () => {
    expect(emailRateLimitMessage(projectLimit, 'signup')).toMatch(/busy.*not created yet.*try again/i);
    expect(emailRateLimitMessage(projectLimit, 'resend')).toMatch(/Nothing was sent/);
    expect(emailRateLimitMessage(perAddressGap, 'resend')).toMatch(/in 37 seconds/);
  });
});
