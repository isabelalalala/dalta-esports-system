'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { getErrorMessage } from '@/utils/errors';
import { defaultParticipants, participantRangeLabel, validateParticipants, validateTournamentDates } from '@/utils/tournaments';
import type { Game } from '@/utils/types';
import { usePageTitle } from '@/utils/page-title';
import PageHeroBackground from '@/components/site/PageHeroBackground';
import {
  AlertCircle,
  Calendar,
  Layers,
  Plus,
  ShieldCheck,
  Trophy,
  Users,
} from 'lucide-react';

const inputClass =
  'w-full p-3.5 rounded-xl bg-stone-50 border border-stone-300 text-stone-950 font-bold text-xs uppercase tracking-wide outline-none focus:border-amber-600 focus:bg-white focus:ring-2 focus:ring-amber-500/20 shadow-xs transition-all';
const labelClass = 'block text-stone-950 text-xs font-black tracking-wider uppercase mb-2';

export default function CreateTournamentPage() {
  usePageTitle('Create tournament');
  const supabase = createClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [rules, setRules] = useState('');
  const [gameId, setGameId] = useState('');
  const [games, setGames] = useState<Game[]>([]);
  const [maxParticipants, setMaxParticipants] = useState('');
  const [checkinMinutes, setCheckinMinutes] = useState('30');
  const [requiresVerification, setRequiresVerification] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [registrationDeadline, setRegistrationDeadline] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const router = useRouter();

  useEffect(() => {
    const fetchGames = async () => {
      const { data, error: gamesError } = await supabase.from('games').select('*').order('name');
      if (gamesError) setError(getErrorMessage(gamesError, 'Could not load the list of games. Please reload the page.'));
      setGames(data || []);
    };
    fetchGames();
  }, [supabase]);

  const selectedGame = games.find((g) => g.id === gameId);

  const handleGameChange = (id: string) => {
    setGameId(id);
    const game = games.find((g) => g.id === id);
    if (game && validateParticipants(game, maxParticipants)) {
      setMaxParticipants(String(defaultParticipants(game)));
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const dateError = validateTournamentDates(startDate, endDate, registrationDeadline);
    if (dateError) {
      setError(dateError);
      setLoading(false);
      return;
    }

    const participantsError = selectedGame ? validateParticipants(selectedGame, maxParticipants) : '';
    if (participantsError) {
      setError(participantsError);
      setLoading(false);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push('/auth/login');
        return;
      }

      const { data: created, error: insertError } = await supabase
        .from('tournaments')
        .insert([
          {
            name,
            description,
            rules: rules.trim() || null,
            game_id: gameId,
            game: games.find((g) => g.id === gameId)?.name ?? '',
            max_participants: Number(maxParticipants),
            requires_verification: requiresVerification,
            checkin_window_minutes: Number(checkinMinutes),
            start_date: startDate,
            end_date: endDate,
            registration_deadline: registrationDeadline,
            created_by: session.user.id,
            status: 'upcoming',
          },
        ])
        .select('id')
        .single();

      if (insertError) throw insertError;

      router.push(created?.id ? `/tournaments/${created.id}` : '/tournaments');
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to create tournament'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full space-y-8 uppercase text-stone-950">
      {/* 1. Main Hero Container */}
      <section className="relative w-full rounded-3xl border border-stone-800/80 bg-stone-950 overflow-hidden shadow-md p-8 sm:p-12 lg:p-14 text-center text-white flex flex-col items-center justify-center space-y-4">
        <PageHeroBackground specificKey="tournaments_hero_bg_path" alt="DALTA Esports Banner" />

        <div className="relative z-10 w-full flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/tournaments"
            className="inline-flex items-center gap-1.5 text-xs font-black text-[#FFCC37] hover:text-[#FFE066] uppercase tracking-wider transition-colors"
          >
            ← Back to Tournaments
          </Link>
          <span className="text-xs font-black text-stone-300 uppercase tracking-wider flex items-center gap-1.5">
            <Plus className="w-4 h-4 text-[#FFCC37]" /> Create Tournament
          </span>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto space-y-3 pt-2">
          <h1
            className="text-3xl sm:text-4xl lg:text-5xl font-black !text-white text-white tracking-wider uppercase leading-tight"
            style={{ color: '#ffffff' }}
          >
            Create New Tournament
          </h1>
          <p
            className="text-xs sm:text-sm text-stone-200 font-semibold uppercase tracking-wider leading-relaxed"
            style={{ color: '#ffffff' }}
          >
            Launch official collegiate competitions, define registration windows, and configure student verification.
          </p>
        </div>
      </section>

      {/* 2. Error Notification */}
      {error && (
        <div role="alert" className="rounded-2xl bg-red-500/10 border border-red-500/30 p-4 sm:p-5 text-red-700 text-xs sm:text-sm font-bold uppercase tracking-wider flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* 3. Structured 2-Column Form */}
      <form onSubmit={handleCreate} className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
        {/* Left Column (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="rounded-3xl border border-stone-200/90 bg-white p-6 sm:p-8 lg:p-10 shadow-xs space-y-5">
            <div className="border-b border-stone-100 pb-3">
              <span className="text-[11px] font-black tracking-widest text-[#5B271E] uppercase">Core Details</span>
              <h2 className="text-xl sm:text-2xl font-black text-stone-950 uppercase tracking-wide flex items-center gap-2">
                <Trophy className="w-5 h-5 text-[#5B271E]" /> Tournament Identity
              </h2>
            </div>

            <div>
              <label htmlFor="tournament-name" className={labelClass}>
                Tournament Title *
              </label>
              <input
                id="tournament-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. DALTA Valorant Invitational 2026"
                className={inputClass}
                required
              />
            </div>

            <div>
              <label htmlFor="game" className={labelClass}>
                Game Discipline *
              </label>
              <select
                id="game"
                value={gameId}
                onChange={(e) => handleGameChange(e.target.value)}
                className={inputClass}
                required
              >
                <option value="">-- Choose Game --</option>
                {games.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="description" className={labelClass}>
                Overview &amp; Description
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Brief introduction, prize pool, or event purpose..."
                className={`${inputClass} resize-none`}
              />
            </div>
          </div>

          <div className="rounded-3xl border border-stone-200/90 bg-white p-6 sm:p-8 lg:p-10 shadow-xs space-y-5">
            <div className="border-b border-stone-100 pb-3">
              <span className="text-[11px] font-black tracking-widest text-[#5B271E] uppercase">Rules &amp; Regulations</span>
              <h2 className="text-xl sm:text-2xl font-black text-stone-950 uppercase tracking-wide flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#5B271E]" /> Match Guidelines
              </h2>
            </div>

            <div>
              <label htmlFor="rules" className={labelClass}>
                Official Rules &amp; Protocols
              </label>
              <textarea
                id="rules"
                value={rules}
                onChange={(e) => setRules(e.target.value)}
                rows={7}
                placeholder="Match format (Best of 3, Single Elimination), server rules, pause policy, dispute handling..."
                className={`${inputClass} resize-none`}
              />
            </div>
          </div>

          <div className="rounded-3xl border border-stone-200/90 bg-white p-6 sm:p-8 shadow-xs space-y-4">
            <div className="border-b border-stone-100 pb-3">
              <span className="text-[11px] font-black tracking-widest text-[#5B271E] uppercase">Compliance</span>
              <h2 className="text-lg sm:text-xl font-black text-stone-950 uppercase tracking-wide flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#5B271E]" /> Eligibility Verification
              </h2>
            </div>

            <label className="flex items-start gap-3.5 rounded-2xl border border-stone-200 bg-stone-50/70 p-4 sm:p-5 cursor-pointer hover:bg-stone-50 transition-colors">
              <input
                type="checkbox"
                checked={requiresVerification}
                onChange={(e) => setRequiresVerification(e.target.checked)}
                className="mt-1 h-4 w-4 accent-amber-500 rounded"
              />
              <span className="space-y-1">
                <span className="font-black text-xs text-stone-950 uppercase tracking-wider block">
                  Enforce Verified Student Status Only
                </span>
                <span className="block text-stone-500 text-[11px] font-semibold tracking-wider leading-relaxed">
                  Every player in the roster must submit student ID verification under Republic Act No. 10173 (Data Privacy Act) and be confirmed by university staff before competing.
                </span>
              </span>
            </label>
          </div>
        </div>

        {/* Right Column (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-3xl border border-stone-200/90 bg-white p-6 sm:p-8 shadow-xs space-y-5">
            <div className="border-b border-stone-100 pb-3">
              <span className="text-[11px] font-black tracking-widest text-[#5B271E] uppercase">Roster Capacity</span>
              <h2 className="text-lg sm:text-xl font-black text-stone-950 uppercase tracking-wide flex items-center gap-2">
                <Users className="w-5 h-5 text-[#5B271E]" /> Quota &amp; Check-In
              </h2>
            </div>

            <div>
              <label htmlFor="max-participants" className={labelClass}>
                Maximum Participants *
              </label>
              <input
                id="max-participants"
                type="number"
                min={selectedGame?.min_participants ?? 2}
                max={selectedGame?.max_participants}
                step="1"
                value={maxParticipants}
                onChange={(e) => setMaxParticipants(e.target.value)}
                placeholder="e.g. 16"
                className={inputClass}
                required
              />
              <p className="mt-1.5 text-[11px] text-stone-500 font-semibold tracking-wider">
                {selectedGame
                  ? `${participantRangeLabel(selectedGame)} for ${selectedGame.name}.`
                  : 'Allowed range is set per game configuration.'}
              </p>
            </div>

            <div>
              <label htmlFor="checkin-minutes" className={labelClass}>
                Check-in Window (Minutes)
              </label>
              <input
                id="checkin-minutes"
                type="number"
                min="0"
                max="240"
                value={checkinMinutes}
                onChange={(e) => setCheckinMinutes(e.target.value)}
                className={inputClass}
                required
              />
              <p className="mt-1.5 text-[11px] text-stone-500 font-semibold tracking-wider">
                Teams check in before their match starts (0 disables mandatory check-in).
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-stone-200/90 bg-white p-6 sm:p-8 shadow-xs space-y-5">
            <div className="border-b border-stone-100 pb-3">
              <span className="text-[11px] font-black tracking-widest text-[#5B271E] uppercase">Schedules</span>
              <h2 className="text-lg sm:text-xl font-black text-stone-950 uppercase tracking-wide flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#5B271E]" /> Timeline Dates
              </h2>
            </div>

            <div>
              <label htmlFor="registration-deadline" className={labelClass}>
                Registration Deadline *
              </label>
              <input
                id="registration-deadline"
                type="date"
                value={registrationDeadline}
                onChange={(e) => setRegistrationDeadline(e.target.value)}
                className={inputClass}
                required
              />
              <p className="mt-1 text-[10px] text-stone-400 font-semibold tracking-wider">
                Must be on or before the tournament start date.
              </p>
            </div>

            <div>
              <label htmlFor="start-date" className={labelClass}>
                Tournament Start Date *
              </label>
              <input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={inputClass}
                required
              />
            </div>

            <div>
              <label htmlFor="end-date" className={labelClass}>
                Tournament End Date *
              </label>
              <input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={inputClass}
                required
              />
            </div>
          </div>

          <div className="rounded-3xl border border-stone-200/90 bg-white p-6 shadow-xs flex flex-col gap-3">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 px-6 rounded-xl bg-gold hover:bg-golddark text-stone-950 font-black text-xs uppercase tracking-widest border border-amber-400 shadow-xs hover:-translate-y-0.5 transition-all disabled:opacity-50"
            >
              {loading ? 'Creating Tournament...' : '+ Launch Tournament'}
            </button>
            <Link
              href="/tournaments"
              className="w-full py-3.5 px-6 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 font-black text-xs uppercase tracking-wider transition-colors text-center"
            >
              Cancel
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
}
