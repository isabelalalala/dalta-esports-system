import { describe, expect, it } from 'vitest';
import { gameInitials, getGameLogo } from '@/utils/game-logos';

describe('getGameLogo', () => {
  it('matches by game id', () => {
    expect(getGameLogo(null, 'mlbb')).toBe('/MLBB LOGO.png');
    expect(getGameLogo(null, 'valorant')).toBe('/VALO LOGO.png');
    expect(getGameLogo(null, 'tekken8')).toBe('/TEKKEN 8 LOGO.png');
    expect(getGameLogo(null, 'codm')).toBe('/CODM LOGO.png');
    expect(getGameLogo(null, 'lol')).toBe('/LOL LOGO.png');
  });
  it('matches by name, ignoring case', () => {
    expect(getGameLogo('Mobile Legends: Bang Bang')).toBe('/MLBB LOGO.png');
    expect(getGameLogo('VALORANT')).toBe('/VALO LOGO.png');
    expect(getGameLogo('Tekken 8')).toBe('/TEKKEN 8 LOGO.png');
    expect(getGameLogo('Call of Duty: Mobile')).toBe('/CODM LOGO.png');
    expect(getGameLogo('League of Legends')).toBe('/LOL LOGO.png');
  });
  it('has a logo for every supported game', () => {
    for (const id of ['mlbb', 'valorant', 'tekken8', 'lol', 'codm']) {
      expect(getGameLogo(null, id)).not.toBeNull();
    }
  });
  it('returns null for unknown games (the component shows initials)', () => {
    expect(getGameLogo('Chess', 'chess')).toBeNull();
    expect(getGameLogo('', '')).toBeNull();
  });
});

describe('gameInitials', () => {
  it('builds a short badge label', () => {
    expect(gameInitials('League of Legends')).toBe('LOL');
    expect(gameInitials('Call of Duty: Mobile')).toBe('COD');
    expect(gameInitials('Valorant')).toBe('VALO');
    expect(gameInitials('')).toBe('?');
  });
});
