'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Award, Crown, Medal, Trophy, Users } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { setUrlParams } from '@/utils/url-state';
import { formatMomentDate } from '@/utils/tournaments';
import {
  filterEntries, finalScore, latestPerGame, seasonOptions, titlesPerGame, titlesPerTeam,
  type ChampionRosterMember, type HallOfFameEntry,
} from '@/utils/hall-of-fame';
import GameFilterChips from '@/components/GameFilterChips';
import GameBadge from '@/components/GameBadge';
import TeamLogo from '@/components/TeamLogo';
import Reveal from '@/components/Reveal';

type Details = Record<string, { mvp_name: string | null; roster: ChampionRosterMember[] | null }>;

// Roster (IGNs) and MVP for logged-in viewers (privacy choice b). The page itself is cached as a
// logged-out visitor sees it, so these are loaded here with the viewer's session: get_hall_of_fame()
// only returns them when someone is logged in. Visitors get nothing extra.
function useChampionDetails(): Details {
  const [details, setDetails] = useState<Details>({});
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data, error } = await supabase.rpc('get_hall_of_fame');
      if (cancelled || error || !data) return;
      const map: Details = {};
      for (const e of data as unknown as HallOfFameEntry[]) map[e.tournament_id] = { mvp_name: e.mvp_name, roster: e.roster };
      setDetails(map);
    })();
    return () => { cancelled = true; };
  }, []);
  return details;
}

// The board with its filters in the address (?game=mlbb&year=2026). useSearchParams needs Suspense:
// the page shows <HallOfFameBoard> unfiltered as the fallback, so the full list is in the first HTML.
export function HallOfFameWithUrl(props: { entries: HallOfFameEntry[]; games: { id: string; name: string }[] }) {
  const params = useSearchParams();
  const game = params.get('game') ?? '';
  const year = params.get('year') ?? '';
  return (
    <HallOfFameBoard
      {...props}
      game={game}
      year={year}
      onChange={(next) => setUrlParams({ game: next.game ?? game, year: next.year ?? year })}
    />
  );
}

export default function HallOfFameBoard({
  entries, games, game = '', year = '', onChange,
}: {
  entries: HallOfFameEntry[];
  games: { id: string; name: string }[];
  game?: string;
  year?: string;
  onChange?: (next: { game?: string; year?: string }) => void;
}) {
  const details = useChampionDetails();
  const seasons = useMemo(() => seasonOptions(entries), [entries]);
  const shown = useMemo(() => filterEntries(entries, game, year), [entries, game, year]);
  const featured = useMemo(() => latestPerGame(entries), [entries]);
  const teams = useMemo(() => titlesPerTeam(entries).slice(0, 5), [entries]);
  const perGame = useMemo(() => titlesPerGame(entries), [entries]);
  const gameName = games.find((g) => g.id === game)?.name ?? 'this game';

  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-stone-200/90 bg-stone-50 p-8 sm:p-14 text-center space-y-2">
        <Trophy className="mx-auto size-10 text-gold" aria-hidden="true" />
        <p className="font-black text-stone-950">No champions yet</p>
        <p className="text-sm text-stone-600 max-w-prose mx-auto">
          The first tournament champion appears here as soon as a final is decided.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {/* Latest champion per game */}
      <section className="space-y-4" aria-labelledby="hof-latest">
        <h2 id="hof-latest" className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-stone-950">Reigning champions</h2>
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,18rem),1fr))] gap-5">
          {featured.map((e, i) => (
            <li key={e.tournament_id} className="min-w-0">
              <Reveal delay={(i % 4) as 0 | 1 | 2 | 3} className="h-full">
                <ChampionCard entry={e} details={details[e.tournament_id]} featured />
              </Reveal>
            </li>
          ))}
        </ul>
      </section>

      {/* Wall of fame */}
      <section className="grid grid-cols-1 @5xl:grid-cols-2 gap-5" aria-label="Wall of fame">
        <div className="rounded-2xl border border-stone-200/90 bg-white p-5 sm:p-6 shadow-xs">
          <h2 className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-wider text-amber-800">
            <Crown className="size-4" aria-hidden="true" /> Most titles
          </h2>
          <ol className="mt-4 space-y-3">
            {teams.map((t, i) => (
              <li key={t.key} className="flex items-center gap-3 min-w-0">
                <span className="w-6 shrink-0 text-center text-sm font-black text-stone-500">{i + 1}</span>
                <TeamLogo url={t.logo} name={t.name} size="sm" />
                <span className="min-w-0 flex-1 truncate font-bold text-stone-950">{t.name}</span>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gold/15 px-2.5 py-1 text-xs font-black text-amber-800">
                  <Trophy className="size-3.5" aria-hidden="true" /> {t.titles}
                </span>
              </li>
            ))}
          </ol>
        </div>
        <div className="rounded-2xl border border-stone-200/90 bg-white p-5 sm:p-6 shadow-xs">
          <h2 className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-wider text-amber-800">
            <Medal className="size-4" aria-hidden="true" /> Titles per game
          </h2>
          <ul className="mt-4 space-y-3">
            {perGame.map((g) => (
              <li key={g.game_id ?? g.game_name} className="flex items-center gap-3">
                <GameBadge game={g.game_id ?? undefined} name={g.game_name} withName size="sm" className="min-w-0 flex-1" />
                <span className="shrink-0 text-sm font-black tabular-nums text-stone-950">
                  {g.titles} {g.titles === 1 ? 'title' : 'titles'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Every champion, filtered */}
      <section className="space-y-5" aria-labelledby="hof-all">
        <div className="flex flex-col gap-4 @3xl:flex-row @3xl:items-end @3xl:justify-between">
          <h2 id="hof-all" className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-stone-950">All champions</h2>
          <div className="flex flex-wrap items-center gap-3 min-w-0">
            {onChange && (
              <>
                <GameFilterChips games={games} value={game} onChange={(id) => onChange({ game: id })} />
                <label className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-stone-600">
                  Season
                  <select
                    value={year}
                    onChange={(ev) => onChange({ year: ev.target.value })}
                    className="h-11 rounded-xl border border-stone-300 bg-surface px-3 text-sm font-bold normal-case text-stone-950 focus:border-amber-600"
                  >
                    <option value="">All seasons</option>
                    {seasons.map((y) => <option key={y} value={String(y)}>{y}</option>)}
                  </select>
                </label>
              </>
            )}
          </div>
        </div>

        {shown.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-600">
            {game ? `No ${gameName} champions${year ? ` in ${year}` : ''} yet.` : `No champions in ${year} yet.`}
          </p>
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,18rem),1fr))] gap-5">
            {shown.map((e, i) => (
              <li key={e.tournament_id} className="min-w-0">
                <Reveal delay={(i % 4) as 0 | 1 | 2 | 3} className="h-full">
                  <ChampionCard entry={e} details={details[e.tournament_id]} />
                </Reveal>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ChampionCard({
  entry: e, details, featured = false,
}: {
  entry: HallOfFameEntry;
  details?: { mvp_name: string | null; roster: ChampionRosterMember[] | null };
  featured?: boolean;
}) {
  const score = finalScore(e);
  const roster = details?.roster ?? null;
  return (
    <article
      className={`group relative flex h-full flex-col gap-4 rounded-2xl border bg-white p-4 sm:p-5 shadow-xs card-interactive has-[.card-link:focus-visible]:ring-2 has-[.card-link:focus-visible]:ring-gold ${
        featured ? 'border-gold/60' : 'border-stone-200/90'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <GameBadge game={e.game_id ?? undefined} name={e.game_name ?? undefined} withName size="xs" className="min-w-0" />
        {!e.is_published && <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-stone-700">Hidden</span>}
        {featured && e.is_published && (
          <span className="inline-flex items-center gap-1 rounded-full bg-gold px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-ink">
            <Crown className="size-3" aria-hidden="true" /> Reigning
          </span>
        )}
      </div>

      <div className="flex items-center gap-3 min-w-0">
        <TeamLogo url={e.champion_logo_url} name={e.champion_team_name} gameId={e.game_id} gameName={e.game_name} size={featured ? 'lg' : 'md'} />
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-widest text-amber-800 inline-flex items-center gap-1">
            <Trophy className="size-3.5" aria-hidden="true" /> Champion
          </p>
          <h3 className="text-lg font-black uppercase leading-tight text-stone-950 break-words">
            {/* The whole card links to the public tournament page */}
            <Link href={`/t/${e.tournament_id}`} className="card-link outline-none after:absolute after:inset-0 after:content-['']">
              {e.champion_team_name}
            </Link>
          </h3>
        </div>
      </div>

      <dl className="space-y-1 text-sm">
        <div className="flex gap-2"><dt className="sr-only">Tournament</dt><dd className="font-bold text-stone-950 break-words">{e.tournament_name}</dd></div>
        <div className="flex gap-2"><dt className="sr-only">Decided</dt><dd className="text-stone-600">{formatMomentDate(e.decided_at)}</dd></div>
        {e.runner_up_team_name && (
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-stone-600">Final</dt>
            <dd className="font-bold text-stone-950 break-words">
              {score ? <span className="tabular-nums">{score}</span> : 'won'} vs {e.runner_up_team_name}
            </dd>
          </div>
        )}
        {details?.mvp_name && (
          <div className="flex gap-2">
            <dt className="inline-flex items-center gap-1 text-stone-600"><Award className="size-3.5 text-maroon" aria-hidden="true" /> MVP</dt>
            <dd className="font-bold text-stone-950 break-words">{details.mvp_name}</dd>
          </div>
        )}
      </dl>

      {/* Logged-in viewers: the winning roster (IGNs). Above the card link so it can be opened. */}
      {roster && roster.length > 0 && (
        <details className="relative z-10 mt-auto rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm">
          <summary className="cursor-pointer list-none inline-flex items-center gap-1.5 font-black uppercase tracking-wider text-xs text-stone-700 [&::-webkit-details-marker]:hidden">
            <Users className="size-3.5" aria-hidden="true" /> Roster ({roster.length})
          </summary>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {roster.map((m, i) => (
              <li key={`${m.ign}-${i}`} className="rounded-full border border-stone-200 bg-white px-2.5 py-0.5 text-xs font-bold text-stone-800">
                {m.ign}{m.role === 'captain' ? ' (C)' : ''}
              </li>
            ))}
          </ul>
        </details>
      )}
    </article>
  );
}
