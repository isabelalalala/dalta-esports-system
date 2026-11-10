import { describe, expect, it } from 'vitest';
import { getErrorMessage } from '@/utils/errors';

const FALLBACK = 'Something went wrong.';

describe('getErrorMessage', () => {
  it('returns the fallback for non-error values', () => {
    expect(getErrorMessage(null, FALLBACK)).toBe(FALLBACK);
    expect(getErrorMessage('oops', FALLBACK)).toBe(FALLBACK);
    expect(getErrorMessage({}, FALLBACK)).toBe(FALLBACK);
  });
  it('hides internal database errors but keeps our own trigger messages', () => {
    const internal = getErrorMessage({ code: '42703', message: 'column teams.secret does not exist' }, 'x');
    expect(internal).not.toContain('column');
    expect(getErrorMessage({ code: 'PGRST202', message: 'Could not find the function public.foo' }, 'x')).not.toContain('foo');
    // permission denied (42501) keeps its own friendly sentence
    expect(getErrorMessage({ code: '42501', message: 'permission denied for table x' }, 'x')).toContain('permission');
    expect(getErrorMessage({ code: 'P0001', message: 'The roster is full (6 players).' }, 'x')).toBe('The roster is full (6 players).');
  });

  it('translates network failures', () => {
    expect(getErrorMessage({ message: 'Failed to fetch' }, FALLBACK)).toContain('internet');
    expect(getErrorMessage({ message: 'NetworkError when attempting to fetch resource.' }, FALLBACK)).toContain('internet');
  });
  it('translates expired sessions', () => {
    expect(getErrorMessage({ code: 'PGRST303', message: 'JWT expired' }, FALLBACK)).toContain('log in again');
    expect(getErrorMessage({ message: 'invalid JWT' }, FALLBACK)).toContain('log in again');
  });
  it('translates RLS and permission denials', () => {
    expect(getErrorMessage({ code: '42501', message: 'permission denied' }, FALLBACK)).toContain('permission');
    expect(getErrorMessage({ message: 'new row violates row-level security policy for table "x"' }, FALLBACK)).toContain('permission');
  });
  it('translates not-found and common Postgres codes', () => {
    expect(getErrorMessage({ code: 'PGRST116', message: '0 rows' }, FALLBACK)).toContain('Not found');
    expect(getErrorMessage({ code: '23505', message: 'duplicate key' }, FALLBACK)).toContain('This already exists.');
    expect(getErrorMessage({ code: '23503', message: 'foreign key' }, FALLBACK)).toContain('still used elsewhere');
    expect(getErrorMessage({ code: '23514', message: 'check violation' }, FALLBACK)).toContain("aren't allowed");
    expect(getErrorMessage({ code: '57014', message: 'canceling statement' }, FALLBACK)).toContain('took too long');
  });
  it('passes through our own readable trigger messages', () => {
    expect(getErrorMessage({ message: 'Only admins can do that.' }, FALLBACK)).toBe('Only admins can do that.');
  });
  it('explains a failed auth email (SMTP problem) in plain words', () => {
    const err = { message: 'Error sending confirmation email', status: 500, code: 'unexpected_failure' };
    expect(getErrorMessage(err, FALLBACK)).toMatch(/couldn't send the email/);
    expect(getErrorMessage({ message: 'Error sending recovery email' }, FALLBACK)).toMatch(/couldn't send the email/);
  });
});
