'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import { dateInManila, emptyFilters, type ReportFilters as Filters, type SavedReport } from '@/utils/reports';

export interface FilterOptions {
  tournaments: { id: string; name: string; game_id: string | null }[];
  games: { id: string; name: string }[];
}

// Loads the tournaments and games for the filter dropdowns
export function useFilterOptions() {
  const [options, setOptions] = useState<FilterOptions>({ tournaments: [], games: [] });
  const [error, setError] = useState('');

  useEffect(() => {
    const supabase = createClient();
    const load = async () => {
      try {
        const [tournaments, games] = await Promise.all([
          supabase.from('tournaments').select('id, name, game_id').order('start_date', { ascending: false }),
          supabase.from('games').select('id, name').order('name'),
        ]);
        if (tournaments.error) throw tournaments.error;
        if (games.error) throw games.error;
        setOptions({ tournaments: tournaments.data || [], games: games.data || [] });
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to load the filters'));
      }
    };
    load();
  }, []);

  return { options, error };
}

// The filters with readable names instead of ids (saved with a report and shown when printing)
export function filterNames(filters: Filters, options: FilterOptions): SavedReport['filters'] {
  return {
    tournament: options.tournaments.find((t) => t.id === filters.tournamentId)?.name,
    game: options.games.find((g) => g.id === filters.gameId)?.name,
    from: filters.from || undefined,
    to: filters.to || undefined,
  };
}

// YYYY-MM-DD for today minus `days`, in Philippine time — the report functions
// interpret from/to as Manila dates regardless of the viewer's time zone.
function daysAgo(days: number) {
  return dateInManila(new Date(Date.now() - days * 86400000).toISOString());
}

const inputClass =
  'border border-brownlight bg-sitebg px-3 py-2 text-white outline-none focus:border-gold';
const presetClass = 'px-3 py-1 rounded-full border border-brownlight text-sm text-gray-300 hover:bg-gold/10';

interface Props {
  value: Filters;
  onChange: (filters: Filters) => void;
  options: FilterOptions;
}

// Tournament, game and date-range filters shared by the report pages
export default function ReportFilters({ value, onChange, options }: Props) {
  // With a game chosen, only that game's tournaments are listed
  const tournaments = value.gameId
    ? options.tournaments.filter((t) => t.game_id === value.gameId)
    : options.tournaments;

  const setGame = (gameId: string) => {
    const tournament = options.tournaments.find((t) => t.id === value.tournamentId);
    // Clear the tournament if it belongs to another game
    const keepTournament = !gameId || tournament?.game_id === gameId;
    onChange({ ...value, gameId, tournamentId: keepTournament ? value.tournamentId : '' });
  };

  return (
    <div className="bg-sitecard border border-brownlight p-4 space-y-3 print:hidden">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <label className="flex flex-col gap-1 text-xs uppercase font-bold text-gray-400">
          Game
          <select value={value.gameId} onChange={(e) => setGame(e.target.value)} className={inputClass}>
            <option value="">All games</option>
            {options.games.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs uppercase font-bold text-gray-400">
          Tournament
          <select value={value.tournamentId} onChange={(e) => onChange({ ...value, tournamentId: e.target.value })} className={inputClass}>
            <option value="">All tournaments</option>
            {tournaments.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs uppercase font-bold text-gray-400">
          From
          <input type="date" value={value.from} onChange={(e) => onChange({ ...value, from: e.target.value })} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs uppercase font-bold text-gray-400">
          To
          <input type="date" value={value.to} onChange={(e) => onChange({ ...value, to: e.target.value })} className={inputClass} />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => onChange({ ...value, from: daysAgo(6), to: daysAgo(0) })} className={presetClass}>
          Last 7 days
        </button>
        <button type="button" onClick={() => onChange({ ...value, from: daysAgo(29), to: daysAgo(0) })} className={presetClass}>
          Last 30 days
        </button>
        <button type="button" onClick={() => onChange({ ...value, from: '', to: '' })} className={presetClass}>
          All dates
        </button>
        <button type="button" onClick={() => onChange(emptyFilters)} className={`${presetClass} ml-auto`}>
          Clear filters
        </button>
      </div>
    </div>
  );
}
