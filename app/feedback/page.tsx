'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import type { Feedback, Tournament } from '@/utils/types';
import StarRating from '@/components/StarRating';

const inputClass =
  'w-full rounded-lg border border-[#00d2ff]/40 bg-[#0a0a0c] px-4 py-3 text-white placeholder-gray-500 outline-none focus:border-[#00d2ff]';

// "Submit feedback & ratings" (use case, Audience / Spectator; players too)
export default function FeedbackPage() {
  const supabase = createClient();
  const searchParams = useSearchParams();

  const [tournaments, setTournaments] = useState<Pick<Tournament, 'id' | 'name'>[]>([]);
  const [myFeedback, setMyFeedback] = useState<Feedback[]>([]);
  const [userId, setUserId] = useState('');
  // ?tournament=<id> pre-selects a tournament (links from tournament and watch pages)
  const [tournamentId, setTournamentId] = useState(searchParams.get('tournament') ?? '');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  // Increase this to make the effect below load everything again
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        setUserId(session.user.id);

        const { data: tournamentsData, error: tourError } = await supabase
          .from('tournaments')
          .select('id, name')
          .order('start_date', { ascending: false });
        if (tourError) throw tourError;
        setTournaments(tournamentsData || []);

        // RLS returns only this user's own feedback
        const { data, error: fbError } = await supabase
          .from('feedback')
          .select('*, tournaments(id, name)')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false });
        if (fbError) throw fbError;
        setMyFeedback(data || []);
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to load'));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [supabase, reloadCount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (rating < 1) {
      setError('Please choose a rating from 1 to 5 stars.');
      return;
    }
    if (comment.trim().length < 3) {
      setError('Please write a short comment (at least 3 characters).');
      return;
    }

    setSaving(true);
    try {
      // Saved without a sentiment; organizers classify it with Gemini later.
      const { error: insertError } = await supabase.from('feedback').insert([{
        user_id: userId,
        tournament_id: tournamentId || null,
        rating,
        comment: comment.trim(),
      }]);
      if (insertError) throw insertError;

      // DFD 5.0: "Feedback Confirmation"
      setMessage('Thanks! Your feedback was received. The organizers use it to improve the next events.');
      setRating(0);
      setComment('');
      setReloadCount((n) => n + 1);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to send your feedback'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-[#0a0a0c] text-white p-10 text-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white px-4 py-10">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <Link href="/dashboard" className="inline-block text-[#00d2ff] hover:underline mb-6">
            ← Back to Dashboard
          </Link>
          <h1 className="text-4xl font-bold text-[#00d2ff]">Feedback</h1>
          <p className="text-gray-400 mt-2">Tell us how the tournament, matches or streams went.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-[#1a1a2e] border border-[#00d2ff] rounded-xl p-6 space-y-4">
          {error && <div className="bg-red-500/10 border border-red-500 text-red-300 px-4 py-3 rounded-lg">{error}</div>}
          {message && <div className="bg-green-500/10 border border-green-500 text-green-300 px-4 py-3 rounded-lg">{message}</div>}

          <label className="block">
            <span className="block text-sm font-semibold text-gray-300 mb-2">About</span>
            <select value={tournamentId} onChange={(e) => setTournamentId(e.target.value)} className={inputClass}>
              <option value="">General (the event or this website)</option>
              {tournaments.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </label>

          <div>
            <span className="block text-sm font-semibold text-gray-300 mb-2">Rating</span>
            <StarRating value={rating} onChange={setRating} />
          </div>

          <label className="block">
            <span className="block text-sm font-semibold text-gray-300 mb-2">Comment</span>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={5}
              maxLength={1000}
              placeholder="What did you like? What should be better?"
              className={inputClass}
              required
            />
            <span className="block text-right text-xs text-gray-500">{comment.length} / 1000</span>
          </label>

          <button
            type="submit"
            disabled={saving}
            className="bg-[#00d2ff] text-black px-6 py-3 rounded-lg font-bold hover:bg-[#00b8e6] transition disabled:opacity-50"
          >
            {saving ? 'Sending...' : 'Send feedback'}
          </button>
        </form>

        <section>
          <h2 className="text-xl font-bold mb-3">My feedback</h2>
          {myFeedback.length === 0 ? (
            <p className="text-gray-500">You haven&apos;t sent any feedback yet.</p>
          ) : (
            <ul className="space-y-3">
              {myFeedback.map((f) => (
                <li key={f.id} className="bg-[#1a1a2e] border border-[#00d2ff]/20 rounded-lg p-4">
                  <div className="flex flex-wrap justify-between gap-2 mb-1">
                    <StarRating value={f.rating} size="sm" />
                    <span className="text-xs text-gray-500">
                      {f.tournaments?.name ?? 'General'} · {new Date(f.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-gray-300 whitespace-pre-wrap">{f.comment}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
