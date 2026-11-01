import { describe, expect, it } from 'vitest';
import { getGameLogo } from '@/utils/game-logos';

describe('getGameLogo', () => {
  it('matches by game id', () => {
    expect(getGameLogo(null, 'mlbb')).toBe('/MLBB LOGO.png');
    expect(getGameLogo(null, 'valorant')).toBe('/VALO LOGO.png');
    expect(getGameLogo(null, 'tekken8')).toBe('/TEKKEN 8 LOGO.png');
    expect(getGameLogo(null, 'codm')).toBe('/CODM LOGO.png');
  });
  it('matches by name, ignoring case', () => {
    expect(getGameLogo('Mobile Legends: Bang Bang')).toBe('/MLBB LOGO.png');
    expect(getGameLogo('VALORANT')).toBe('/VALO LOGO.png');
    expect(getGameLogo('Tekken 8')).toBe('/TEKKEN 8 LOGO.png');
    expect(getGameLogo('Call of Duty: Mobile')).toBe('/CODM LOGO.png');
  });
  it('returns null for games without a logo', () => {
    expect(getGameLogo('League of Legends', 'lol')).toBeNull();
    expect(getGameLogo('', '')).toBeNull();
  });
});
