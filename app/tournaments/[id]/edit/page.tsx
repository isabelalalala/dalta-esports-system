'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { getErrorMessage } from '@/utils/errors';
import { defaultParticipants, participantRangeLabel, toDateInput, validateParticipants, validateTournamentDates } from '@/utils/tournaments';
import type { Game } from '@/utils/types';
import PageLoading from '@/components/PageLoading';
import { usePageTitle } from '@/utils/page-title';
import PageHeroBackground from '@/components/site/PageHeroBackground';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Edit3,
  Layers,
  Save,
  ShieldAlert,
  ShieldCheck,
  Trophy,
  Users,
} from 'lucide-react';

function getGameLogo(game: string): string | null {
  const g = (game || '').toLowerCase().trim();
  if (g.includes('mlbb') || g.includes('mobile legends')) return '/MLBB LOGO.png';
  if (g.includes('valo') || g.includes('valorant')) return '/VALO LOGO.png';
  if (g.includes('tekken')) return '/TEKKEMN 8 LOGO.png';
  if (g.includes('codm') || g.includes('call of duty')) return '/CODM LOGO.png';
  return null;
}

const inputClass =
  'w-full p-3.5 rounded-xl bg-stone-50 border border-stone-300 text-stone-950 font-bold text-xs uppercase tracking-wide outline-none focus:border-amber-600 focus:bg-white focus:ring-2 focus:ring-amber-500/20 shadow-xs transition-all';
const labelClass = 'block text-stone-950 text-xs font-black tracking-wider uppercase mb-2';

export default function EditTournamentPage() {
  usePageTitle('Edit tournament');
  const supabase = createClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [rules, setRules] = useState('');
  const [gameId, setGameId] = useState('');
  const [games, setGames] = useState<Game[]>([]);
  const [maxParticipants, setMaxParticipants] = useState('');
  const [checkinMinutes, setCheckinMinutes] = useState('30');
  const [requiresVerification, setRequiresVerification] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [registrationDeadline, setRegistrationDeadline] = useState('');
  const [cancelled, setCancelled] = useState(false);
  const [loaded, setLoaded] = useState({ gameId: '', maxParticipants: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  useEffect(() => {
    const fetchTournament = async () => {
      try {
        const { data: gamesData, error: gamesError } = await supabase.from('games').select('*').order('name');
        if (gamesError) throw gamesError;
        setGames(gamesData || []);

        const { data, error: fetchError } = await supabase
          .from('tournaments')
          .select('*')
          .eq('id', id)
          .single();

        if (fetchError) throw fetchError;

        setName(data.name);
        setDescription(data.description || '');
        setRules(data.rules || '');
        setGameId(data.game_id ?? '');
        setMaxParticipants(String(data.max_participants ?? ''));
        setLoaded({ gameId: data.game_id ?? '', maxParticipants: String(data.max_participants ?? '') });
        setCheckinMinutes(String(data.checkin_window_minutes ?? 0));
        setRequiresVerification(data.requires_verification ?? false);
        setStartDate(toDateInput(data.start_date));
        setEndDate(toDateInput(data.end_date));
        setRegistrationDeadline(toDateInput(data.registration_deadline));
        setCancelled(data.status === 'cancelled');
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to load tournament'));
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchTournament();
  }, [id, supabase]);

  const selectedGame = games.find((g) => g.id === gameId);
  const participantsChanged = gameId !== loaded.gameId || maxParticipants !== loaded.maxParticipants;
  const gameLogo = selectedGame ? getGameLogo(selectedGame.name) : null;

  const handleGameChange = (newGameId: string) => {
    setGameId(newGameId);
    const game = games.find((g) => g.id === newGameId);
    if (!game) return;
    if (newGameId === loaded.gameId) {
      setMaxParticipants(loaded.maxParticipants);
    } else {
      setMaxParticipants(String(defaultParticipants(game)));
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    const dateErr = validateTournamentDates(startDate, endDate, registrationDeadline);
    if (dateErr) {
      setError(dateErr);
      setSaving(false);
      return;
    }

    if (participantsChanged && selectedGame) {
      const partErr = validateParticipants(selectedGame, maxParticipants);
      if (partErr) {
        setError(partErr);
        setSaving(false);
        return;
      }
    }

    try {
      const { data: updated, error: updateError } = await supabase
        .from('tournaments')
        .update({
          name,
          description: description || null,
          rules: rules || null,
          game: selectedGame?.name || '',
          game_id: gameId || null,
          max_participants: parseInt(maxParticipants, 10),
          checkin_window_minutes: parseInt(checkinMinutes || '0', 10),
          requires_verification: requiresVerification,
          start_date: startDate,
          end_date: endDate,
          registration_deadline: registrationDeadline,
          status: cancelled ? 'cancelled' : 'upcoming',
        })
        .eq('id', id)
        .select('id');

      if (updateError) throw updateError;
      if (!updated || updated.length === 0) throw new Error('Only admin and staff can edit tournaments.');

      router.push(`/tournaments/${id}`);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update tournament'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <PageLoading label="Loading tournament..." />;
  }

  return (
    <div className="w-full space-y-8 uppercase text-stone-950">
      {/* 1. Main Hero Container */}
      <section className="relative w-full rounded-3xl border border-stone-800/80 bg-stone-950 overflow-hidden shadow-md p-8 sm:p-12 lg:p-14 text-center text-white flex flex-col items-center justify-center space-y-4">
        <PageHeroBackground specificKey="tournaments_hero_bg_path" alt="DALTA Esports Banner" />

        <div className="relative z-10 w-full flex flex-wrap items-center justify-between gap-4">
          <Link
            href={`/tournaments/${id}`}
            className="inline-flex items-center gap-1.5 text-xs font-black text-[#FFCC37] hover:text-[#FFE066] uppercase tracking-wider transition-colors"
          >
            ← Back to Tournament
          </Link>
          <span className="text-xs font-black text-stone-300 uppercase tracking-wider flex items-center gap-1.5">
            <Edit3 className="w-4 h-4 text-[#FFCC37]" /> Tournament Administration
          </span>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto space-y-3 pt-2">
          <h1
            className="text-3xl sm:text-4xl lg:text-5xl font-black !text-white text-white tracking-wider uppercase leading-tight"
            style={{ color: '#ffffff' }}
          >
            Edit Tournament
          </h1>
          <p
            className="text-xs sm:text-sm text-stone-200 font-semibold uppercase tracking-wider leading-relaxed"
            style={{ color: '#ffffff' }}
          >
            Editing <span className="text-[#FFCC37] font-black">{name || 'Tournament'}</span> · Configure rules, quota, verification, and schedules.
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

      {/* 3. Structured 2-Column Editorial Form */}
      <form onSubmit={handleUpdate} className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
        {/* Left Column (5 Cols): Live Game Showcase & Governance */}
        <div className="lg:col-span-5 space-y-6">
          {/* Card 1: Game Division Visual Showcase */}
          {gameLogo ? (
            <div className="relative aspect-[4/3] max-h-[340px] w-full rounded-3xl border border-stone-800/80 bg-[#0e0c0b] overflow-hidden shadow-md flex items-center justify-center p-6 sm:p-8">
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    'radial-gradient(circle at 85% 85%, rgba(164, 148, 140, 0.35) 0%, rgba(35, 30, 27, 0.7) 45%, #0e0c0b 100%)',
                }}
              />
              <div className="absolute top-4 right-4 z-10">
                <span className="text-[10px] font-black tracking-widest px-3 py-1 rounded-md border border-[#FFCC37]/50 bg-[#FFCC37]/15 text-[#FFCC37] uppercase">
                  {cancelled ? 'Cancelled' : 'Active'}
                </span>
              </div>
              <div className="relative z-0 w-36 h-36 sm:w-40 sm:h-40 flex items-center justify-center">
                <Image
                  src={gameLogo}
                  alt={selectedGame?.name || 'Game Logo'}
                  fill
                  sizes="200px"
                  className="object-contain drop-shadow-[0_8px_24px_rgba(0,0,0,0.7)]"
                  priority
                />
              </div>
              <div className="absolute bottom-4 left-6 right-6 text-center z-10">
                <span className="text-xs font-black tracking-widest text-stone-400 uppercase">
                  {selectedGame?.name} Division
                </span>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-stone-200/90 bg-stone-50/70 p-8 text-center space-y-2">
              <Trophy className="w-8 h-8 text-[#5B271E] mx-auto" />
              <p className="text-xs font-black text-stone-900 uppercase tracking-wider">
                {selectedGame ? selectedGame.name : 'Select a game discipline'}
              </p>
            </div>
          )}

          {/* Card 2: Student Verification Compliance */}
          <div className="rounded-3xl border border-stone-200/90 bg-white p-6 sm:p-8 shadow-xs space-y-4">
            <div className="border-b border-stone-100 pb-3">
              <span className="text-[11px] font-black tracking-widest text-[#5B271E] uppercase">Compliance</span>
              <h2 className="text-lg sm:text-xl font-black text-stone-950 uppercase tracking-wide flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#5B271E]" /> Student Eligibility
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
                  Enforce Verified Students Only
                </span>
                <span className="block text-stone-500 text-[11px] font-semibold tracking-wider leading-relaxed">
                  Every player in the roster must submit student ID verification under Republic Act No. 10173 (Data Privacy Act) and be confirmed by university staff before competing.
                </span>
              </span>
            </label>
          </div>

          {/* Card 3: Emergency Status & Cancellation */}
          <div className="rounded-3xl border border-rose-200 bg-rose-50/40 p-6 shadow-xs space-y-3">
            <span className="text-[11px] font-black tracking-widest text-rose-800 uppercase">Emergency Control</span>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={cancelled}
                onChange={(e) => setCancelled(e.target.checked)}
                className="mt-1 h-4 w-4 accent-rose-600 rounded"
              />
              <span className="space-y-0.5">
                <span className="block font-black text-xs text-rose-950 uppercase tracking-wider">
                  Cancel This Tournament
                </span>
                <span className="block text-[11px] text-rose-700 font-semibold tracking-wider leading-relaxed">
                  Cancelling locks registration and matches immediately, overriding automated date-based progression.
                </span>
              </span>
            </label>
          </div>

          {/* Card 4: Action Controls */}
          <div className="rounded-3xl border border-stone-200/90 bg-white p-6 shadow-xs flex flex-col gap-3">
            <button
              type="submit"
              disabled={saving}
              className="w-full py-4 px-6 rounded-xl bg-gold hover:bg-golddark text-stone-950 font-black text-xs uppercase tracking-widest border border-amber-400 shadow-xs hover:-translate-y-0.5 transition-all disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving Changes...' : 'Save Tournament Changes'}</span>
            </button>
            <Link
              href={`/tournaments/${id}`}
              className="w-full py-3.5 px-6 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 font-black text-xs uppercase tracking-wider transition-colors text-center"
            >
              Cancel
            </Link>
          </div>
        </div>

        {/* Right Column (7 Cols): Configuration Form */}
        <div className="lg:col-span-7 space-y-6">
          {/* Card 5: Core Identity */}
          <div className="rounded-3xl border border-stone-200/90 bg-white p-6 sm:p-8 lg:p-10 shadow-xs space-y-5">
            <div className="border-b border-stone-100 pb-3">
              <span className="text-[11px] font-black tracking-widest text-[#5B271E] uppercase">Core Details</span>
              <h2 className="text-xl sm:text-2xl font-black text-stone-950 uppercase tracking-wide flex items-center gap-2">
                <Trophy className="w-5 h-5 text-[#5B271E]" /> Tournament Settings
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
                placeholder="e.g. DALTA Valorant Invitational"
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

          {/* Card 6: Participation Quota & Check-In */}
          <div className="rounded-3xl border border-stone-200/90 bg-white p-6 sm:p-8 shadow-xs space-y-5">
            <div className="border-b border-stone-100 pb-3">
              <span className="text-[11px] font-black tracking-widest text-[#5B271E] uppercase">Roster Capacity</span>
              <h2 className="text-lg sm:text-xl font-black text-stone-950 uppercase tracking-wide flex items-center gap-2">
                <Users className="w-5 h-5 text-[#5B271E]" /> Quota &amp; Check-In
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="max-participants" className={labelClass}>
                  Max Participants *
                </label>
                <input
                  id="max-participants"
                  type="number"
                  min={participantsChanged ? (selectedGame?.min_participants ?? 2) : undefined}
                  max={participantsChanged ? selectedGame?.max_participants : undefined}
                  step="1"
                  value={maxParticipants}
                  onChange={(e) => setMaxParticipants(e.target.value)}
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
                  Teams check in before their match starts (0 disables check-in).
                </p>
              </div>
            </div>
          </div>

          {/* Card 7: Timeline & Critical Dates */}
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          </div>

          {/* Card 8: Rules & Match Format */}
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
        </div>
      </form>
    </div>
  );
}
