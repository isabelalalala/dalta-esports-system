// Hall of Fame (202611101100_hall_of_fame): the shape returned by get_hall_of_fame() and the small
// calculations behind the page (latest champion per game, titles per team, filters). Plain code,
// shared by the server page, the client parts and the tests.

export interface ChampionRosterMember {
  ign: string;
  role: string; // 'captain' | 'player'
}

export interface HallOfFameEntry {
  tournament_id: string;
  tournament_name: string;
  season: number; // the tournament's start-date year
  game_id: string | null;
  game_name: string | null;
  champion_team_id: string | null; // null when the team was deleted later (the name stays)
  champion_team_name: string;
  champion_logo_url: string | null;
  runner_up_team_name: string | null;
  champion_score: number | null;
  runner_up_score: number | null;
  decided_at: string;
  is_published: boolean;
  // Logged-in viewers only (privacy choice b); null for visitors
  mvp_name: string | null;
  roster: ChampionRosterMember[] | null;
}

// The newest champion of each game, newest game first (entries come newest first)
export function latestPerGame(entries: HallOfFameEntry[]): HallOfFameEntry[] {
  const seen = new Set<string>();
  const out: HallOfFameEntry[] = [];
  for (const e of entries) {
    const key = e.game_id ?? e.game_name ?? '';
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

export interface TeamTitles {
  key: string;
  name: string; // the name of its latest title
  logo: string | null;
  titles: number;
}

// Most titles per team. A team is counted by its id, so a renamed team still adds up; a deleted
// team (id gone) falls back to its saved name. Ties: the team that won most recently first.
export function titlesPerTeam(entries: HallOfFameEntry[]): TeamTitles[] {
  const map = new Map<string, TeamTitles & { last: string }>();
  for (const e of entries) {
    const key = e.champion_team_id ?? `name:${e.champion_team_name.trim().toLowerCase()}`;
    const row = map.get(key);
    if (row) {
      row.titles += 1;
      if (e.decided_at > row.last) {
        row.last = e.decided_at;
        row.name = e.champion_team_name;
        row.logo = e.champion_logo_url;
      }
    } else {
      map.set(key, { key, name: e.champion_team_name, logo: e.champion_logo_url, titles: 1, last: e.decided_at });
    }
  }
  return [...map.values()]
    .sort((a, b) => b.titles - a.titles || b.last.localeCompare(a.last))
    .map((row) => ({ key: row.key, name: row.name, logo: row.logo, titles: row.titles }));
}

// Titles per game, most first
export function titlesPerGame(entries: HallOfFameEntry[]): { game_id: string | null; game_name: string; titles: number }[] {
  const map = new Map<string, { game_id: string | null; game_name: string; titles: number }>();
  for (const e of entries) {
    const key = e.game_id ?? e.game_name ?? '';
    const row = map.get(key) ?? { game_id: e.game_id, game_name: e.game_name ?? 'Other', titles: 0 };
    row.titles += 1;
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => b.titles - a.titles || a.game_name.localeCompare(b.game_name));
}

// Seasons for the year filter, newest first
export function seasonOptions(entries: HallOfFameEntry[]): number[] {
  return [...new Set(entries.map((e) => e.season).filter((y) => Number.isFinite(y)))].sort((a, b) => b - a);
}

// Apply the page's filters ('' = all)
export function filterEntries(entries: HallOfFameEntry[], game: string, year: string): HallOfFameEntry[] {
  return entries.filter((e) => (!game || e.game_id === game) && (!year || String(e.season) === year));
}

// "3–1", or '' when no score was entered
export function finalScore(e: Pick<HallOfFameEntry, 'champion_score' | 'runner_up_score'>): string {
  return e.champion_score === null || e.runner_up_score === null ? '' : `${e.champion_score}–${e.runner_up_score}`;
}
