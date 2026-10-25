import { describe, expect, it } from 'vitest';
import { getEmailError, isValidEmail, safeNextPath } from '@/utils/auth';

const ORIGIN = 'https://dalta-esports.up.railway.app';

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
