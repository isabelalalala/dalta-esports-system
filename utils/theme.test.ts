import { describe, expect, it } from 'vitest';
import { nextThemeChoice, resolveTheme, THEME_INIT_SCRIPT, THEME_KEY } from '@/utils/theme';

describe('resolveTheme', () => {
  it('follows the system by default', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });
  it('uses a saved choice over the system', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});

describe('nextThemeChoice', () => {
  it('cycles system -> light -> dark -> system', () => {
    expect(nextThemeChoice('system')).toBe('light');
    expect(nextThemeChoice('light')).toBe('dark');
    expect(nextThemeChoice('dark')).toBe('system');
  });
});

describe('THEME_INIT_SCRIPT', () => {
  it('reads the same storage key and is valid JavaScript', () => {
    expect(THEME_INIT_SCRIPT).toContain(THEME_KEY);
    expect(() => new Function(THEME_INIT_SCRIPT)).not.toThrow();
  });
});
