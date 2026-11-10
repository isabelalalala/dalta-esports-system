import { describe, expect, it } from 'vitest';
import {
  filterEntries, finalScore, latestPerGame, seasonOptions, titlesPerGame, titlesPerTeam, type HallOfFameEntry,
} from '@/utils/hall-of-fame';

const entry = (o: Partial<HallOfFameEntry>): HallOfFameEntry => ({
  tournament_id: 't', tournament_name: 'Cup', season: 2026, game_id: 'mlbb', game_name: 'MLBB',
  champion_team_id: 'team-a', champion_team_name: 'Alpha', champion_logo_url: null,
  runner_up_team_name: 'Beta', champion_score: 3, runner_up_score: 1, decided_at: '2026-11-01T10:00:00Z',
  is_published: true, mvp_name: null, roster: null, ...o,
});

// Newest first, like get_hall_of_fame()
const entries = [
  entry({ tournament_id: 't4', game_id: 'valorant', game_name: 'Valorant', champion_team_id: 'team-v', champion_team_name: 'Vipers', decided_at: '2026-11-05T10:00:00Z' }),
  entry({ tournament_id: 't3', champion_team_name: 'Alpha Prime', decided_at: '2026-10-01T10:00:00Z' }), // team-a, renamed
  entry({ tournament_id: 't2', champion_team_id: null, champion_team_name: 'Gone Team', decided_at: '2026-06-01T10:00:00Z' }),
  entry({ tournament_id: 't1', season: 2025, decided_at: '2025-11-01T10:00:00Z' }), // team-a again
];

describe('hall of fame helpers', () => {
  it('picks the newest champion per game', () => {
    expect(latestPerGame(entries).map((e) => e.tournament_id)).toEqual(['t4', 't3']);
  });

  it('counts titles per team by id, so a renamed team adds up under its latest name', () => {
    const rows = titlesPerTeam(entries);
    expect(rows[0]).toMatchObject({ key: 'team-a', name: 'Alpha Prime', titles: 2 });
    // a deleted team is counted by its saved name
    expect(rows.find((r) => r.name === 'Gone Team')?.titles).toBe(1);
  });

  it('counts titles per game', () => {
    expect(titlesPerGame(entries)).toEqual([
      { game_id: 'mlbb', game_name: 'MLBB', titles: 3 },
      { game_id: 'valorant', game_name: 'Valorant', titles: 1 },
    ]);
  });

  it('lists seasons newest first and filters by game and year', () => {
    expect(seasonOptions(entries)).toEqual([2026, 2025]);
    expect(filterEntries(entries, 'mlbb', '2025').map((e) => e.tournament_id)).toEqual(['t1']);
    expect(filterEntries(entries, '', '')).toHaveLength(4);
  });

  it('formats the final score from the champion side', () => {
    expect(finalScore({ champion_score: 3, runner_up_score: 1 })).toBe('3–1');
    expect(finalScore({ champion_score: null, runner_up_score: 1 })).toBe('');
  });
});
