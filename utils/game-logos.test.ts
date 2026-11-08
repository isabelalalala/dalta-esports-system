import { describe, expect, it } from 'vitest';
import { gameInitials, getGameLogo, getGameLogoFit } from '@/utils/game-logos';

describe('getGameLogo', () => {
  it('matches by game id', () => {
    expect(getGameLogo(null, 'mlbb')).toBe('/games/mlbb.webp');
    expect(getGameLogo(null, 'valorant')).toBe('/games/valorant.webp');
    expect(getGameLogo(null, 'tekken8')).toBe('/games/tekken8.webp');
    expect(getGameLogo(null, 'codm')).toBe('/games/codm.webp');
    expect(getGameLogo(null, 'lol')).toBe('/games/lol.webp');
  });
  it('matches by name, ignoring case', () => {
    expect(getGameLogo('Mobile Legends: Bang Bang')).toBe('/games/mlbb.webp');
    expect(getGameLogo('VALORANT')).toBe('/games/valorant.webp');
    expect(getGameLogo('Tekken 8')).toBe('/games/tekken8.webp');
    expect(getGameLogo('Call of Duty: Mobile')).toBe('/games/codm.webp');
    expect(getGameLogo('League of Legends')).toBe('/games/lol.webp');
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

describe('getGameLogoFit', () => {
  it('gives every supported game a width and its real aspect ratio', () => {
    for (const id of ['mlbb', 'valorant', 'tekken8', 'lol', 'codm']) {
      expect(getGameLogoFit(null, id)).toMatch(/^w-\[\d+%\] aspect-\[\d+\/\d+\]$/);
    }
    expect(getGameLogoFit('Chess', 'chess')).toBeNull();
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
