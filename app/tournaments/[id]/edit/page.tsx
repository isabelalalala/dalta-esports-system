'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { getErrorMessage } from '@/utils/errors';
import { toDateInput, validateTournamentDates } from '@/utils/tournaments';
import type { Game } from '@/utils/types';
import PageLoading from '@/components/PageLoading';

export default function EditTournamentPage() {
  const supabase = createClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [rules, setRules] = useState('');
  const [gameId, setGameId] = useState('');
  const [games, setGames] = useState<Game[]>([]);
  const [maxParticipants, setMaxParticipants] = useState('');
  // Minutes before each match that check-in opens (0 = off)
  const [checkinMinutes, setCheckinMinutes] = useState('30');
  const [requiresVerification, setRequiresVerification] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [registrationDeadline, setRegistrationDeadline] = useState('');
  // Only 'cancelled' is chosen by hand; every other status comes from the dates
  const [cancelled, setCancelled] = useState(false);
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
        setRequiresVerification(data.requires_verification);
        setCheckinMinutes(String(data.checkin_window_minutes ?? 30));
        // Date inputs need YYYY-MM-DD, not the full timestamp from the database
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

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    // Check the date order before saving (the database checks it too)
    const dateError = validateTournamentDates(startDate, endDate, registrationDeadline);
    if (dateError) {
      setError(dateError);
      setSaving(false);
      return;
    }

    try {
      const { data: updated, error: updateError } = await supabase
        .from('tournaments')
        .update({
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
          status: cancelled ? 'cancelled' : 'upcoming',
        })
        .eq('id', id)
        .select('id');

      if (updateError) throw updateError;
      // RLS blocks silently (no error, no rows), so check that something was saved
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
    <div className="min-h-screen bg-sitebg text-white px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <Link href={`/tournaments/${id}`} className="inline-block text-gold hover:underline mb-6">
          ← Back to Tournament
        </Link>

        <h1 className="font-pixel text-xl sm:text-2xl leading-relaxed text-gold mb-8 text-center">
          Edit Tournament
        </h1>

        <form
          onSubmit={handleUpdate}
          className="bg-sitecard border-2 border-gold shadow-[6px_6px_0_var(--color-brown)] p-4 sm:p-8 space-y-5"
        >
          {error && (
            <div className="bg-red-500/10 border border-red-500 text-red-400 px-4 py-3">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Tournament Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-brownlight bg-sitebg px-4 py-3 text-white outline-none focus:border-gold"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Game *
            </label>
            <select
              value={gameId}
              onChange={(e) => setGameId(e.target.value)}
              className="w-full border border-brownlight bg-sitebg px-4 py-3 text-white outline-none focus:border-gold"
              required
            >
              <option value="">-- Select Game --</option>
              {games.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full border border-brownlight bg-sitebg px-4 py-3 text-white outline-none focus:border-gold resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Rules
            </label>
            <textarea
              value={rules}
              onChange={(e) => setRules(e.target.value)}
              rows={6}
              placeholder="Format, match rules, check-in time, etc."
              className="w-full border border-brownlight bg-sitebg px-4 py-3 text-white placeholder-gray-500 outline-none focus:border-gold"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Max Participants *
            </label>
            <input
              type="number"
              min="1"
              value={maxParticipants}
              onChange={(e) => setMaxParticipants(e.target.value)}
              className="w-full border border-brownlight bg-sitebg px-4 py-3 text-white outline-none focus:border-gold"
              required
            />
          </div>

          <label className="flex items-start gap-3 text-sm text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={requiresVerification}
              onChange={(e) => setRequiresVerification(e.target.checked)}
              className="mt-1 h-4 w-4 accent-gold"
            />
            <span>
              <span className="font-semibold">Only verified students can register</span>
              <span className="block text-gray-500">Every team member must have their student details verified first. Teams already registered aren&apos;t removed, but can only be approved once everyone is verified.</span>
            </span>
          </label>

          <label className="block text-sm font-semibold text-gray-300">
            Check-in window (minutes before each match, 0 = no check-in)
            <input
              type="number"
              min="0"
              max="240"
              value={checkinMinutes}
              onChange={(e) => setCheckinMinutes(e.target.value)}
              className="mt-2 w-full border border-brownlight bg-sitebg px-4 py-3 text-white outline-none focus:border-gold"
              required
            />
          </label>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Start Date *
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border border-brownlight bg-sitebg px-4 py-3 text-white outline-none focus:border-gold"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                End Date *
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full border border-brownlight bg-sitebg px-4 py-3 text-white outline-none focus:border-gold"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Registration Deadline *
              </label>
              <input
                type="date"
                value={registrationDeadline}
                onChange={(e) => setRegistrationDeadline(e.target.value)}
                className="w-full border border-brownlight bg-sitebg px-4 py-3 text-white outline-none focus:border-gold"
                required
              />
            </div>
          </div>

          {/* Upcoming / registration closed / ongoing / completed follow the dates automatically */}
          <label className="flex items-start gap-3 border border-red-500/40 p-4 cursor-pointer">
            <input
              type="checkbox"
              checked={cancelled}
              onChange={(e) => setCancelled(e.target.checked)}
              className="mt-1"
            />
            <span>
              <span className="block font-semibold text-red-300">Cancel this tournament</span>
              <span className="block text-sm text-gray-400">
                The status otherwise follows the dates: Upcoming → Registration Closed → Ongoing → Completed.
              </span>
            </span>
          </label>

          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <button
              type="submit"
              disabled={saving}
              className="bg-gold text-black font-bold px-6 py-3 hover:bg-golddark transition disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>

            <Link
              href={`/tournaments/${id}`}
              className="border border-gray-500 text-gray-300 font-bold px-6 py-3 hover:bg-gray-800 transition text-center"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
