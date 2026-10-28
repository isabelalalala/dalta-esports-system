'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import type { Feedback, Match, Tournament } from '@/utils/types';
import { isBye, roundLabel } from '@/utils/tournaments';
import StarRating from '@/components/StarRating';
import PageLoading from '@/components/PageLoading';
import { usePageTitle } from '@/utils/page-title';
import PageHeroBackground from '@/components/site/PageHeroBackground';
import { CheckCircle2, MessageSquare, Send, Sparkles, Star } from 'lucide-react';

const inputClass =
  'w-full p-3 rounded-xl bg-white text-stone-950 border border-stone-300 placeholder:text-stone-400 tracking-wide focus:border-amber-600 focus:ring-2 focus:ring-amber-500/20 shadow-xs outline-none transition-all font-medium text-xs sm:text-sm uppercase';

interface MatchOption {
  id: string;
  label: string;
}

export default function FeedbackPage() {
  return (
    <Suspense fallback={<PageLoading label="Loading feedback page..." />}>
      <FeedbackPageContent />
    </Suspense>
  );
}

function FeedbackPageContent() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  usePageTitle('Feedback & Ratings');

  const [tournaments, setTournaments] = useState<Pick<Tournament, 'id' | 'name'>[]>([]);
  const [myFeedback, setMyFeedback] = useState<Feedback[]>([]);
  const [tournamentId, setTournamentId] = useState(searchParams.get('tournament') ?? '');
  const [matchId, setMatchId] = useState(searchParams.get('match') ?? '');
  const [matchOptions, setMatchOptions] = useState<{ matchesFor: string; options: MatchOption[] }>({
    matchesFor: '',
    options: [],
  });
  const [matchLabels, setMatchLabels] = useState<Record<string, string>>({});
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) return;

        const [tourRes, fbRes] = await Promise.all([
          supabase.from('tournaments').select('id, name').order('start_date', { ascending: false }),
          supabase
            .from('feedback')
            .select('*, tournaments(id, name), matches(id, round, match_number)')
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: false }),
        ]);
        if (tourRes.error) throw tourRes.error;
        if (fbRes.error) throw fbRes.error;
        setTournaments(tourRes.data || []);
        setMyFeedback(fbRes.data || []);
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to load the feedback page'));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [supabase, reloadCount]);

  useEffect(() => {
    if (!tournamentId) return;

    let cancelled = false;
    const loadMatches = async () => {
      const { data: matches, error: matchesError } = await supabase
        .from('matches')
        .select('id, round, match_number, team_a_id, team_b_id, is_forfeit')
        .eq('tournament_id', tournamentId)
        .order('round')
        .order('match_number');
      if (matchesError || cancelled) return;

      const teamIds = [
        ...new Set((matches || []).flatMap((m) => [m.team_a_id, m.team_b_id]).filter(Boolean)),
      ] as string[];
      let teamMap: Record<string, string> = {};
      if (teamIds.length > 0) {
        const { data: teams } = await supabase.from('teams').select('id, name').in('id', teamIds);
        teamMap = Object.fromEntries((teams || []).map((t) => [t.id, t.name]));
      }
      if (cancelled) return;

      const labels: Record<string, string> = {};
      const options: MatchOption[] = [];
      for (const m of (matches || []) as Match[]) {
        if (isBye(m)) continue;
        const round = roundLabel(m.round, 4);
        const a = m.team_a_id ? teamMap[m.team_a_id] ?? 'TBD' : 'TBD';
        const b = m.team_b_id ? teamMap[m.team_b_id] ?? 'TBD' : 'TBD';
        const lbl = `${round} · ${a} vs ${b}`;
        labels[m.id] = lbl;
        options.push({ id: m.id, label: lbl });
      }

      setMatchLabels((prev) => ({ ...prev, ...labels }));
      setMatchOptions({ matchesFor: tournamentId, options });
    };

    loadMatches();
    return () => {
      cancelled = true;
    };
  }, [supabase, tournamentId]);

  const options = matchOptions.matchesFor === tournamentId ? matchOptions.options : [];
  const chosenMatchId = tournamentId && options.some((o) => o.id === matchId) ? matchId : '';

  const alreadySent = myFeedback.some(
    (f) =>
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
      if (!response.ok)
        throw new Error(body.error || 'Your feedback could not be sent. Please try again.');

      setMessage('Thanks! Your feedback was received. The organizers use it to improve future events.');
      setRating(0);
      setComment('');
      setReloadCount((n) => n + 1);
    } catch (err) {
      setError(getErrorMessage(err, 'Your feedback could not be sent. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoading label="Loading feedback page..." />;

  const aboutLabel = (f: Feedback) => {
    if (f.match_id)
      return `${f.tournaments?.name ?? 'Tournament'} · ${matchLabels[f.match_id] ?? `Match ${f.matches?.match_number ?? ''}`}`;
    if (f.tournaments) return f.tournaments.name;
    return f.target_removed ? 'A deleted tournament' : 'General Organization Feedback';
  };

  return (
    <div className="w-full space-y-8 uppercase text-stone-950">
      {/* 1. Main Hero Container with Official Banner */}
      <section className="relative w-full rounded-3xl border border-stone-800/80 bg-stone-950 overflow-hidden shadow-md p-8 sm:p-14 lg:p-16 text-center text-white flex flex-col items-center justify-center space-y-4">
        <PageHeroBackground specificKey="hero_banner_path" alt="DALTA Esports Feedback Banner" />

        <div className="relative z-10 w-full flex items-center justify-between">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-black text-[#FFCC37] hover:text-[#FFE066] uppercase tracking-wider transition-colors"
          >
            ← Back to Dashboard
          </Link>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto space-y-3 pt-2">
          <h1
            className="text-4xl sm:text-5xl lg:text-6xl font-black !text-white text-white tracking-wider uppercase leading-tight"
            style={{ color: '#ffffff' }}
          >
            Feedback &amp; Ratings
          </h1>
          <p
            className="text-base sm:text-lg !text-white text-stone-200 font-medium uppercase tracking-wide leading-relaxed"
            style={{ color: '#ffffff' }}
          >
            Share your voice on tournament organization, broadcast quality, and competitive experiences.
          </p>
        </div>
      </section>

      {/* 2. Feedback Form & My History Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Form: Submit Feedback */}
        <section className="lg:col-span-7 bg-white border border-stone-200/90 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
          <div>
            <h2 className="text-base sm:text-lg font-black text-[#5B271E] tracking-wider uppercase">
              Submit Your Review
            </h2>
            <p className="text-xs text-stone-500 font-medium normal-case mt-0.5">
              Your feedback is analyzed using AI to guide tournament adjustments and committee decisions.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div
                role="alert"
                className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 text-xs font-bold tracking-wider shadow-2xs"
              >
                {error}
              </div>
            )}
            {message && (
              <div
                role="status"
                className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-4 text-xs font-bold tracking-wider shadow-2xs flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{message}</span>
              </div>
            )}

            <label className="block">
              <span className="block text-xs font-black text-stone-800 tracking-wider uppercase mb-1.5">
                Select Scope / Tournament
              </span>
              <select
                value={tournamentId}
                onChange={(e) => {
                  setTournamentId(e.target.value);
                  setMatchId('');
                }}
                className={inputClass}
              >
                <option value="">General (Organization &amp; Campus Portal)</option>
                {tournaments.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>

            {tournamentId && options.length > 0 && (
              <label className="block">
                <span className="block text-xs font-black text-stone-800 tracking-wider uppercase mb-1.5">
                  Specific Match (Optional)
                </span>
                <select
                  value={chosenMatchId}
                  onChange={(e) => setMatchId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">The Entire Tournament</option>
                  {options.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {alreadySent ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 font-bold tracking-wide">
                You already sent feedback for this selection. Thank you! You can choose another tournament or match to review.
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <span className="block text-xs font-black text-stone-800 tracking-wider uppercase">
                    Your Rating
                  </span>
                  <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 inline-block shadow-2xs">
                    <StarRating value={rating} onChange={setRating} />
                  </div>
                </div>

                <label className="block">
                  <span className="block text-xs font-black text-stone-800 tracking-wider uppercase mb-1.5">
                    Your Review &amp; Comments
                  </span>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={4}
                    maxLength={1000}
                    placeholder="Tell us what went well, and what could be improved..."
                    className={`${inputClass} font-normal normal-case`}
                    required
                  />
                  <span className="block text-right text-[11px] text-stone-400 font-medium mt-1">
                    {comment.length} / 1000 characters
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-gold hover:bg-golddark text-stone-950 font-black px-6 py-3 text-xs tracking-widest border border-amber-400 shadow-xs hover:-translate-y-0.5 transition-all disabled:opacity-50 inline-flex items-center gap-2 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{saving ? 'Sending...' : 'Submit Feedback'}</span>
                </button>
              </>
            )}
          </form>
        </section>

        {/* Right Section: My Submitted Feedback */}
        <section className="lg:col-span-5 bg-white border border-stone-200/90 rounded-2xl p-6 sm:p-8 shadow-xs space-y-5">
          <div className="flex items-center justify-between gap-2 border-b border-stone-100 pb-3">
            <h2 className="text-base sm:text-lg font-black text-stone-950 tracking-wider uppercase flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#5B271E]" />
              <span>My History</span>
            </h2>
            <span className="text-xs font-black text-stone-500">
              {myFeedback.length} Submitted
            </span>
          </div>

          {myFeedback.length === 0 ? (
            <div className="rounded-2xl border border-stone-200/80 bg-stone-50/70 p-8 text-center text-stone-500 font-bold tracking-wider text-xs">
              You haven&apos;t submitted any feedback yet.
            </div>
          ) : (
            <ul className="space-y-3.5 max-h-[600px] overflow-y-auto pr-1">
              {myFeedback.map((f) => (
                <li
                  key={f.id}
                  className="bg-stone-50/80 border border-stone-200/90 rounded-xl p-4 shadow-2xs space-y-2 hover:bg-stone-50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <StarRating value={f.rating} size="sm" />
                    <span className="text-[11px] font-bold text-stone-500 tracking-wider">
                      {new Date(f.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <p className="text-xs font-bold text-[#5B271E] tracking-wider">
                    {aboutLabel(f)}
                  </p>

                  <p className="text-xs text-stone-700 font-normal normal-case whitespace-pre-wrap break-words leading-relaxed">
                    {f.comment}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
