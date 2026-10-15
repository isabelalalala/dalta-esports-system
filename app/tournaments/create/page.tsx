'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { getErrorMessage } from '@/utils/errors';
import { validateTournamentDates } from '@/utils/tournaments';
import type { Game } from '@/utils/types';

export default function CreateTournamentPage() {
  const supabase = createClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [rules, setRules] = useState('');
  const [gameId, setGameId] = useState('');
  const [games, setGames] = useState<Game[]>([]);
  const [maxParticipants, setMaxParticipants] = useState('');
  // School tournaments: on by default
  // Minutes before each match that check-in opens (0 = off)
  const [checkinMinutes, setCheckinMinutes] = useState('30');
  const [requiresVerification, setRequiresVerification] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [registrationDeadline, setRegistrationDeadline] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const router = useRouter();

  // Load the supported games for the dropdown
  useEffect(() => {
    const fetchGames = async () => {
      const { data } = await supabase.from('games').select('*').order('name');
      setGames(data || []);
    };
    fetchGames();
  }, [supabase]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Check the date order before saving (the database checks it too)
    const dateError = validateTournamentDates(startDate, endDate, registrationDeadline);
    if (dateError) {
      setError(dateError);
      setLoading(false);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push('/auth/login');
        return;
      }

      const { error: insertError } = await supabase.from('tournaments').insert([
        {
          name,
          description,
          rules: rules.trim() || null,
          // game_id links to the games table; game keeps the name for older pages
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
      ]);

      if (insertError) throw insertError;

      router.push('/tournaments');
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to create tournament'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-sitebg text-white px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <Link href="/tournaments" className="inline-block text-gold hover:underline mb-6">
          ← Back to Tournaments
        </Link>

        <h1 className="font-pixel text-xl sm:text-2xl leading-relaxed text-gold mb-8 text-center">
          Create Tournament
        </h1>

        <form
          onSubmit={handleCreate}
          className="bg-sitecard border-2 border-gold shadow-[6px_6px_0_var(--color-brown)] p-8 shadow-xl space-y-5"
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
              placeholder="e.g., Valorant Championship 2025"
              className="w-full border border-brownlight bg-sitebg px-4 py-3 text-white placeholder-gray-500 outline-none focus:border-gold"
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
              placeholder="Tournament details..."
              rows={4}
              className="w-full border border-brownlight bg-sitebg px-4 py-3 text-white placeholder-gray-500 outline-none focus:border-gold resize-none"
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
              placeholder="e.g., 16"
              className="w-full border border-brownlight bg-sitebg px-4 py-3 text-white placeholder-gray-500 outline-none focus:border-gold"
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
              <span className="block text-gray-500">Every team member must have their student details verified first.</span>
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

          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="bg-gold text-black font-bold px-6 py-3 hover:bg-golddark transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create Tournament'}
            </button>

            <Link
              href="/tournaments"
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
