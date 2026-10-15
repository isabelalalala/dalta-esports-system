'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { getErrorMessage } from '@/utils/errors';
import type { Game } from '@/utils/types';

export default function EditTournamentPage() {
  const supabase = createClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [gameId, setGameId] = useState('');
  const [games, setGames] = useState<Game[]>([]);
  const [maxParticipants, setMaxParticipants] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [registrationDeadline, setRegistrationDeadline] = useState('');
  const [status, setStatus] = useState('upcoming');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  useEffect(() => {
    const fetchTournament = async () => {
      try {
        const { data: gamesData } = await supabase.from('games').select('*').order('name');
        setGames(gamesData || []);

        const { data, error: fetchError } = await supabase
          .from('tournaments')
          .select('*')
          .eq('id', id)
          .single();

        if (fetchError) throw fetchError;

        setName(data.name);
        setDescription(data.description);
        // Older tournaments may have no game_id yet; the admin picks one here
        setGameId(data.game_id ?? '');
        setMaxParticipants(data.max_participants);
        setStartDate(data.start_date);
        setEndDate(data.end_date);
        setRegistrationDeadline(data.registration_deadline);
        setStatus(data.status);
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

    try {
      const { error: updateError } = await supabase
        .from('tournaments')
        .update({
          name,
          description,
          game_id: gameId,
          game: games.find((g) => g.id === gameId)?.name ?? '',
          max_participants: Number(maxParticipants),
          start_date: startDate,
          end_date: endDate,
          registration_deadline: registrationDeadline,
          status,
        })
        .eq('id', id);

      if (updateError) throw updateError;

      router.push(`/tournaments/${id}`);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update tournament'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] text-white flex items-center justify-center">
        <p>Loading tournament...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <Link href={`/tournaments/${id}`} className="inline-block text-[#00d2ff] hover:underline mb-6">
          ← Back to Tournament
        </Link>

        <h1 className="text-4xl font-bold text-[#00d2ff] mb-8 text-center">
          Edit Tournament
        </h1>

        <form
          onSubmit={handleUpdate}
          className="bg-[#1a1a2e] border border-[#00d2ff] rounded-xl p-8 shadow-xl space-y-5"
        >
          {error && (
            <div className="bg-red-500/10 border border-red-500 text-red-400 px-4 py-3 rounded-lg">
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
              className="w-full rounded-lg border border-[#00d2ff]/40 bg-[#0a0a0c] px-4 py-3 text-white outline-none focus:border-[#00d2ff]"
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
              className="w-full rounded-lg border border-[#00d2ff]/40 bg-[#0a0a0c] px-4 py-3 text-white outline-none focus:border-[#00d2ff]"
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
              className="w-full rounded-lg border border-[#00d2ff]/40 bg-[#0a0a0c] px-4 py-3 text-white outline-none focus:border-[#00d2ff] resize-none"
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
              className="w-full rounded-lg border border-[#00d2ff]/40 bg-[#0a0a0c] px-4 py-3 text-white outline-none focus:border-[#00d2ff]"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Start Date *
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-[#00d2ff]/40 bg-[#0a0a0c] px-4 py-3 text-white outline-none focus:border-[#00d2ff]"
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
                className="w-full rounded-lg border border-[#00d2ff]/40 bg-[#0a0a0c] px-4 py-3 text-white outline-none focus:border-[#00d2ff]"
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
                className="w-full rounded-lg border border-[#00d2ff]/40 bg-[#0a0a0c] px-4 py-3 text-white outline-none focus:border-[#00d2ff]"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-lg border border-[#00d2ff]/40 bg-[#0a0a0c] px-4 py-3 text-white outline-none focus:border-[#00d2ff]"
            >
              <option value="upcoming">Upcoming</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <button
              type="submit"
              disabled={saving}
              className="bg-[#00d2ff] text-black font-bold px-6 py-3 rounded-lg hover:bg-[#00b8e6] transition disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>

            <Link
              href={`/tournaments/${id}`}
              className="border border-gray-500 text-gray-300 font-bold px-6 py-3 rounded-lg hover:bg-gray-800 transition text-center"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
