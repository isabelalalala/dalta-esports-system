'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import type { Feedback, Match, Tournament } from '@/utils/types';
import { isBye, roundLabel } from '@/utils/tournaments';
import StarRating from '@/components/StarRating';
import PageLoading from '@/components/PageLoading';

const inputClass =
  'w-full border border-brownlight bg-sitebg px-4 py-3 text-white placeholder-gray-500 outline-none focus:border-gold disabled:opacity-50';

// A match of the chosen tournament, with a readable label ("Semifinals · Team A vs Team B")
interface MatchOption {
  id: string;
  label: string;
}

// "Submit feedback & ratings" (use case, Audience / Spectator; players too).
// One feedback per tournament, per match, and one general feedback (enforced in the database).
export default function FeedbackPage() {
  const supabase = createClient();
  const searchParams = useSearchParams();

  const [tournaments, setTournaments] = useState<Pick<Tournament, 'id' | 'name'>[]>([]);
  const [myFeedback, setMyFeedback] = useState<Feedback[]>([]);
  // ?tournament=<id> pre-selects a tournament (links from tournament and watch pages),
  // ?match=<id> a match of it
  const [tournamentId, setTournamentId] = useState(searchParams.get('tournament') ?? '');
  const [matchId, setMatchId] = useState(searchParams.get('match') ?? '');
  // Matches of the chosen tournament; matchesFor says which tournament the list belongs to
  const [matchOptions, setMatchOptions] = useState<{ matchesFor: string; options: MatchOption[] }>({ matchesFor: '', options: [] });
  // Every match label we know, for the "My feedback" list
  const [matchLabels, setMatchLabels] = useState<Record<string, string>>({});
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

        const { data: tournamentsData, error: tourError } = await supabase
          .from('tournaments')
          .select('id, name')
          .order('start_date', { ascending: false });
        if (tourError) throw tourError;
        setTournaments(tournamentsData || []);

        // RLS returns only this user's own feedback
        const { data, error: fbError } = await supabase
          .from('feedback')
          .select('*, tournaments(id, name), matches(id, round, match_number)')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false });
        if (fbError) throw fbError;
        setMyFeedback(data || []);
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to load the feedback page'));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [supabase, reloadCount]);

  // The chosen tournament's matches (byes left out), for the "Which match?" list
  useEffect(() => {
    if (!tournamentId) return;
    const loadMatches = async () => {
      try {
        const { data: matchData, error: matchError } = await supabase
          .from('matches')
          .select('id, round, match_number, team_a_id, team_b_id')
          .eq('tournament_id', tournamentId)
          .order('round')
          .order('match_number');
        if (matchError) throw matchError;

        const matches = (matchData || []) as Pick<Match, 'id' | 'round' | 'match_number' | 'team_a_id' | 'team_b_id'>[];
        const teamIds = [...new Set(matches.flatMap((m) => [m.team_a_id, m.team_b_id]).filter((t): t is string => !!t))];
        let names: Record<string, string> = {};
        if (teamIds.length > 0) {
          const { data: teamsData, error: teamsError } = await supabase.from('teams').select('id, name').in('id', teamIds);
          if (teamsError) throw teamsError;
          names = Object.fromEntries((teamsData || []).map((t) => [t.id, t.name]));
        }

        const roundCount = matches.reduce((max, m) => Math.max(max, m.round), 0);
        const options = matches
          .filter((m) => !isBye(m))
          .map((m) => ({
            id: m.id,
            label: `${roundLabel(m.round, roundCount)} · ${m.team_a_id ? names[m.team_a_id] ?? 'TBD' : 'TBD'} vs ${m.team_b_id ? names[m.team_b_id] ?? 'TBD' : 'TBD'}`,
          }));
        setMatchOptions({ matchesFor: tournamentId, options });
        setMatchLabels((current) => ({ ...current, ...Object.fromEntries(options.map((o) => [o.id, o.label])) }));
      } catch {
        // Not important enough to block the form: feedback about the whole tournament still works
        setMatchOptions({ matchesFor: tournamentId, options: [] });
      }
    };
    loadMatches();
  }, [supabase, tournamentId]);

  const options = matchOptions.matchesFor === tournamentId ? matchOptions.options : [];
  // A ?match= id that isn't in this tournament's list is ignored
  const chosenMatchId = tournamentId && options.some((o) => o.id === matchId) ? matchId : '';

  // Already sent feedback about exactly this? (the database refuses a second one too)
  const alreadySent = myFeedback.some((f) =>
    !f.target_removed &&
    (f.tournament_id ?? '') === tournamentId &&
    (f.match_id ?? '') === chosenMatchId
  );

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
      // The server saves it as you and classifies the sentiment with Gemini (server only).
      // If Gemini is unavailable, the feedback is still saved ("pending analysis").
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournament_id: tournamentId || null,
          match_id: chosenMatchId || null,
          rating,
          comment: comment.trim(),
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Your feedback could not be sent. Please try again.');

      // DFD 5.0: "Feedback Confirmation"
      setMessage('Thanks! Your feedback was received. The organizers use it to improve the next events.');
      setRating(0);
      setComment('');
      setReloadCount((n) => n + 1);
    } catch (err) {
      setError(getErrorMessage(err, 'Your feedback could not be sent. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoading />;

  const aboutLabel = (f: Feedback) => {
    if (f.match_id) return `${f.tournaments?.name ?? 'Tournament'} · ${matchLabels[f.match_id] ?? `Match ${f.matches?.match_number ?? ''}`}`;
    if (f.tournaments) return f.tournaments.name;
    return f.target_removed ? 'A deleted tournament' : 'General';
  };

  return (
    <div className="min-h-screen bg-sitebg text-white px-4 py-10">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <Link href="/dashboard" className="inline-block text-gold hover:underline mb-6">
            ← Back to Dashboard
          </Link>
          <h1 className="font-pixel text-xl sm:text-2xl leading-relaxed text-gold">Feedback</h1>
          <p className="text-gray-400 mt-2">Tell us how the tournament, matches or streams went.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-sitecard border-2 border-gold shadow-[6px_6px_0_var(--color-brown)] p-4 sm:p-6 space-y-4">
          {error && <div role="alert" className="bg-red-500/10 border border-red-500 text-red-300 px-4 py-3">{error}</div>}
          {message && <div role="status" className="bg-green-500/10 border border-green-500 text-green-300 px-4 py-3">{message}</div>}

          <label className="block">
            <span className="block text-sm font-semibold text-gray-300 mb-2">About</span>
            <select
              value={tournamentId}
              onChange={(e) => { setTournamentId(e.target.value); setMatchId(''); }}
              className={inputClass}
            >
              <option value="">General (the event or this website)</option>
              {tournaments.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </label>

          {tournamentId && options.length > 0 && (
            <label className="block">
              <span className="block text-sm font-semibold text-gray-300 mb-2">Which match? (optional)</span>
              <select value={chosenMatchId} onChange={(e) => setMatchId(e.target.value)} className={inputClass}>
                <option value="">The whole tournament</option>
                {options.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </label>
          )}

          {alreadySent ? (
            <p className="bg-sitebg border border-brownlight px-4 py-3 text-gray-300">
              You already sent feedback about this. Thank you! You can still choose another tournament or match.
            </p>
          ) : (
            <>
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
                className="w-full sm:w-auto bg-gold text-black px-6 py-3 font-bold hover:bg-golddark transition disabled:opacity-50"
              >
                {saving ? 'Sending...' : 'Send feedback'}
              </button>
            </>
          )}
        </form>

        <section>
          <h2 className="text-xl font-bold mb-3">My feedback</h2>
          {myFeedback.length === 0 ? (
            <p className="text-gray-500 border-2 border-dashed border-brown p-6 text-center">
              You haven&apos;t sent any feedback yet.
            </p>
          ) : (
            <ul className="space-y-3">
              {myFeedback.map((f) => (
                <li key={f.id} className="bg-sitecard border border-brown p-4">
                  <div className="flex flex-wrap justify-between gap-2 mb-1">
                    <StarRating value={f.rating} size="sm" />
                    <span className="text-xs text-gray-500">
                      {aboutLabel(f)} · {new Date(f.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-gray-300 whitespace-pre-wrap break-words">{f.comment}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
