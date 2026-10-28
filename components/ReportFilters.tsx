'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import { dateInManila, emptyFilters, type ReportFilters as Filters, type SavedReport } from '@/utils/reports';

export interface FilterOptions {
  tournaments: { id: string; name: string; game_id: string | null }[];
  games: { id: string; name: string }[];
}

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

export function filterNames(filters: Filters, options: FilterOptions): SavedReport['filters'] {
  return {
    tournament: options.tournaments.find((t) => t.id === filters.tournamentId)?.name,
    game: options.games.find((g) => g.id === filters.gameId)?.name,
    from: filters.from || undefined,
    to: filters.to || undefined,
  };
}

function daysAgo(days: number) {
  return dateInManila(new Date(Date.now() - days * 86400000).toISOString());
}

const inputClass =
  'w-full p-3 rounded-xl bg-white text-stone-950 border border-stone-300 placeholder:text-stone-400 uppercase tracking-wide focus:border-amber-600 focus:ring-2 focus:ring-amber-500/20 shadow-xs outline-none transition-all font-medium text-xs sm:text-sm';

const presetClass =
  'px-3.5 py-1.5 rounded-full border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-800 text-xs font-black uppercase tracking-wider cursor-pointer transition-all shadow-2xs';

interface Props {
  value: Filters;
  onChange: (filters: Filters) => void;
  options: FilterOptions;
}

export default function ReportFilters({ value, onChange, options }: Props) {
  const tournaments = value.gameId
    ? options.tournaments.filter((t) => t.game_id === value.gameId)
    : options.tournaments;

  const setGame = (gameId: string) => {
    const tournament = options.tournaments.find((t) => t.id === value.tournamentId);
    const keepTournament = !gameId || tournament?.game_id === gameId;
    onChange({ ...value, gameId, tournamentId: keepTournament ? value.tournamentId : '' });
  };

  return (
    <div className="bg-white border border-stone-200/90 rounded-2xl p-6 shadow-xs space-y-4 print:hidden text-stone-950">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <label className="flex flex-col gap-1.5 text-xs font-black text-stone-800 tracking-wider uppercase">
          <span>Game Title</span>
          <select value={value.gameId} onChange={(e) => setGame(e.target.value)} className={inputClass}>
            <option value="">All Games</option>
            {options.games.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-black text-stone-800 tracking-wider uppercase">
          <span>Tournament</span>
          <select value={value.tournamentId} onChange={(e) => onChange({ ...value, tournamentId: e.target.value })} className={inputClass}>
            <option value="">All Tournaments</option>
            {tournaments.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-black text-stone-800 tracking-wider uppercase">
          <span>From Date</span>
          <input type="date" value={value.from} onChange={(e) => onChange({ ...value, from: e.target.value })} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-black text-stone-800 tracking-wider uppercase">
          <span>To Date</span>
          <input type="date" value={value.to} onChange={(e) => onChange({ ...value, to: e.target.value })} className={inputClass} />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-stone-100">
        <button type="button" onClick={() => onChange({ ...value, from: daysAgo(6), to: daysAgo(0) })} className={presetClass}>
          Last 7 Days
        </button>
        <button type="button" onClick={() => onChange({ ...value, from: daysAgo(29), to: daysAgo(0) })} className={presetClass}>
          Last 30 Days
        </button>
        <button type="button" onClick={() => onChange({ ...value, from: '', to: '' })} className={presetClass}>
          All Dates
        </button>
        <button type="button" onClick={() => onChange(emptyFilters)} className={`${presetClass} ml-auto text-amber-700`}>
          Clear Filters
        </button>
      </div>
    </div>
  );
}
