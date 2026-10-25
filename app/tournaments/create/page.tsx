'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { getErrorMessage } from '@/utils/errors';
import { defaultParticipants, participantRangeLabel, validateParticipants, validateTournamentDates } from '@/utils/tournaments';
import type { Game } from '@/utils/types';
import { usePageTitle } from '@/utils/page-title';

export default function CreateTournamentPage() {
  usePageTitle('Create tournament');
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
      const { data, error: gamesError } = await supabase.from('games').select('*').order('name');
      // Without the games the form can't be filled in, so say so instead of showing an empty list
      if (gamesError) setError(getErrorMessage(gamesError, 'Could not load the list of games. Please reload the page.'));
      setGames(data || []);
    };
    fetchGames();
  }, [supabase]);

  const selectedGame = games.find((g) => g.id === gameId);

  // Picking a game suggests a participant limit inside that game's range,
  // unless the current one already fits
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

    // Check the date order before saving (the database checks it too)
    const dateError = validateTournamentDates(startDate, endDate, registrationDeadline);
    if (dateError) {
      setError(dateError);
      setLoading(false);
      return;
    }

    // Check the participant range for the game (the database checks it too)
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
    <main id="main-content" className="min-h-screen bg-sitebg text-white px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <Link href="/tournaments" className="inline-block text-gold hover:underline mb-6">
          ← Back to Tournaments
        </Link>

        <h1 className="font-pixel text-xl sm:text-2xl leading-relaxed text-gold mb-8 text-center">
          Create Tournament
        </h1>

        <form
          onSubmit={handleCreate}
          className="bg-sitecard border-2 border-gold shadow-[6px_6px_0_var(--color-brown)] p-4 sm:p-8 space-y-5"
        >
          {error && (
            <div role="alert" className="bg-red-500/10 border border-red-500 text-red-400 px-4 py-3">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="tournament-name" className="block text-sm font-semibold text-gray-300 mb-2">
              Tournament Name *
            </label>
            <input
              id="tournament-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Valorant Championship 2025"
              className="w-full border border-brownlight bg-sitebg px-4 py-3 text-white placeholder-gray-400 outline-none focus:border-gold"
              required
            />
          </div>

          <div>
            <label htmlFor="game" className="block text-sm font-semibold text-gray-300 mb-2">
              Game *
            </label>
            <select
              id="game"
              value={gameId}
              onChange={(e) => handleGameChange(e.target.value)}
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
            <label htmlFor="description" className="block text-sm font-semibold text-gray-300 mb-2">
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tournament details..."
              rows={4}
              className="w-full border border-brownlight bg-sitebg px-4 py-3 text-white placeholder-gray-400 outline-none focus:border-gold resize-none"
            />
          </div>

          <div>
            <label htmlFor="rules" className="block text-sm font-semibold text-gray-300 mb-2">
              Rules
            </label>
            <textarea
              id="rules"
              value={rules}
              onChange={(e) => setRules(e.target.value)}
              rows={6}
              placeholder="Format, match rules, check-in time, etc."
              className="w-full border border-brownlight bg-sitebg px-4 py-3 text-white placeholder-gray-400 outline-none focus:border-gold"
            />
          </div>

          <div>
            <label htmlFor="max-participants" className="block text-sm font-semibold text-gray-300 mb-2">
              Max Participants *
            </label>
            <input
              id="max-participants"
              type="number"
              min={selectedGame?.min_participants ?? 2}
              max={selectedGame?.max_participants}
              step="1"
              value={maxParticipants}
              onChange={(e) => setMaxParticipants(e.target.value)}
              placeholder={selectedGame ? `e.g., ${defaultParticipants(selectedGame)}` : 'Pick a game first'}
              className="w-full border border-brownlight bg-sitebg px-4 py-3 text-white placeholder-gray-400 outline-none focus:border-gold"
              required
            />
            <p className="mt-1 text-xs text-gray-400">
              {selectedGame
                ? `${participantRangeLabel(selectedGame)} for ${selectedGame.name}.`
                : 'The allowed range depends on the game.'}
            </p>
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
              <span className="block text-gray-400">Every team member must have their student details verified first.</span>
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
              <label htmlFor="start-date" className="block text-sm font-semibold text-gray-300 mb-2">
                Start Date *
              </label>
              <input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border border-brownlight bg-sitebg px-4 py-3 text-white outline-none focus:border-gold"
                required
              />
            </div>

            <div>
              <label htmlFor="end-date" className="block text-sm font-semibold text-gray-300 mb-2">
                End Date *
              </label>
              <input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full border border-brownlight bg-sitebg px-4 py-3 text-white outline-none focus:border-gold"
                required
              />
            </div>

            <div>
              <label htmlFor="registration-deadline" className="block text-sm font-semibold text-gray-300 mb-2">
                Registration Deadline *
              </label>
              <input
                id="registration-deadline"
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
    </main>
  );
}
