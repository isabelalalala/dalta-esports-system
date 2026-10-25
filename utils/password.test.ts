import { describe, expect, it } from 'vitest';
import { getPasswordChecks, getPasswordError, getPasswordStrength, PASSWORD_MIN_LENGTH } from '@/utils/password';

describe('getPasswordError', () => {
  it('accepts a password that meets every rule', () => {
    expect(getPasswordError('Blue-Kettle42')).toBeNull();
    expect(getPasswordError('m0on!Rise#Tide')).toBeNull();
  });
  it(`needs at least ${PASSWORD_MIN_LENGTH} characters`, () => {
    expect(getPasswordError('Ab1!xyzq')).toMatch(/10 characters/);
    expect(getPasswordError('Ab1!xyzqwe')).toBeNull();
  });
  it('needs uppercase, lowercase, a number and a symbol', () => {
    expect(getPasswordError('blue-kettle42')).toMatch(/uppercase/);
    expect(getPasswordError('BLUE-KETTLE42')).toMatch(/lowercase/);
    expect(getPasswordError('Blue-Kettle!!')).toMatch(/number/);
    expect(getPasswordError('BlueKettle4242')).toMatch(/symbol/);
  });
  it('refuses common passwords even with numbers and symbols added', () => {
    expect(getPasswordError('Password123!')).toMatch(/too easy to guess/);
    expect(getPasswordError('Qwerty!2026')).toMatch(/too easy to guess/);
    expect(getPasswordError('DaltaEsports#1')).toMatch(/too easy to guess/);
  });
  it("refuses passwords containing the user's email name or full name", () => {
    expect(getPasswordError('Juandelacruz#7', { email: 'juandelacruz@gmail.com' })).toMatch(/too easy to guess/);
    expect(getPasswordError('Santos-2026!x', { fullName: 'Maria Santos' })).toMatch(/too easy to guess/);
    // Very short name parts are ignored so they don't block everything
    expect(getPasswordError('Blue-Kettle42', { fullName: 'Jo Li' })).toBeNull();
  });
});

describe('getPasswordChecks', () => {
  it('lists every rule as not met for an empty password', () => {
    expect(getPasswordChecks('').every((check) => !check.ok)).toBe(true);
  });
});

describe('getPasswordStrength', () => {
  it('is weak until every rule is met, then fair, then strong when long', () => {
    expect(getPasswordStrength('short')).toBe('weak');
    expect(getPasswordStrength('Blue-Kettle42')).toBe('fair');
    expect(getPasswordStrength('Blue-Kettle42-Sunrise')).toBe('strong');
  });
});
