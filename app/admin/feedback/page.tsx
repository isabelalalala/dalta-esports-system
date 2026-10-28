'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import type { Feedback, Sentiment, Tournament } from '@/utils/types';
import { isFeedbackRetryable } from '@/utils/feedback';
import { usePageTitle } from '@/utils/page-title';
import StarRating from '@/components/StarRating';
import ExportButtons from '@/components/ExportButtons';
import { Star } from 'lucide-react';
import PageLoading from '@/components/PageLoading';
import PageError from '@/components/PageError';
import PageHeroBackground from '@/components/site/PageHeroBackground';

const inputClass =
  'w-full p-3 rounded-xl bg-white text-stone-950 border border-stone-300 placeholder:text-stone-400 uppercase tracking-wide focus:border-amber-600 focus:ring-2 focus:ring-amber-500/20 shadow-xs outline-none transition-all font-medium text-xs sm:text-sm';

const sentimentStyles: Record<Sentiment, string> = {
  positive: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  neutral: 'bg-stone-100 text-stone-800 border-stone-200',
  negative: 'bg-red-50 text-red-800 border-red-200',
};

async function runClassification(): Promise<{ classified: number; remaining: number; reason: string | null }> {
  const response = await fetch('/api/feedback/classify', { method: 'POST' });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'The retry failed. Please try again.');
  return body;
}

export default function FeedbackAnalysisPage() {
  const supabase = createClient();
  usePageTitle('Feedback Analysis');
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [tournaments, setTournaments] = useState<Pick<Tournament, 'id' | 'name'>[]>([]);
  const [role, setRole] = useState('');
  const [tournamentFilter, setTournamentFilter] = useState('all');
  const [sentimentFilter, setSentimentFilter] = useState('all');
  const [classifying, setClassifying] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();
        if (profileError) throw profileError;
        setRole(profileData?.role ?? '');
        if (profileData?.role !== 'admin') return;

        const [tourRes, fbRes] = await Promise.all([
          supabase.from('tournaments').select('id, name').order('name'),
          supabase
            .from('feedback')
            .select('*, tournaments(name), matches(match_number, round)')
            .order('created_at', { ascending: false }),
        ]);
        if (tourRes.error) throw tourRes.error;
        if (fbRes.error) throw fbRes.error;
        setTournaments(tourRes.data || []);
        setFeedback(fbRes.data || []);
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to load feedback'));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [supabase, reloadCount]);

  const handleClassify = async () => {
    setClassifying(true);
    setError('');
    setMessage('');
    try {
      const result = await runClassification();
      if (result.classified === 0 && result.reason) {
        setError(`Nothing could be classified: ${result.reason}`);
      } else {
        setMessage(
          result.remaining > 0
            ? `Classified ${result.classified}. ${result.remaining} still pending${result.reason ? ` (${result.reason})` : ''}; click again for the next batch.`
            : `Classified ${result.classified}. All feedback is classified.`
        );
      }
      setReloadCount((n) => n + 1);
    } catch (err) {
      setError(getErrorMessage(err, 'Classification failed'));
    } finally {
      setClassifying(false);
    }
  };

  if (loading) return <PageLoading />;
  if (!role && error) return <PageError message={error} />;
  if (role !== 'admin') {
    return (
      <div className="w-full bg-white text-stone-950 p-10 text-center uppercase space-y-4">
        <p className="font-extrabold text-stone-900">Only administrators can view the feedback analysis.</p>
        <Link href="/feedback" className="inline-block text-amber-700 hover:text-amber-800 font-bold underline">
          ← Submit feedback instead
        </Link>
      </div>
    );
  }

  const inTournament = feedback.filter((f) => {
    if (tournamentFilter === 'all') return true;
    if (tournamentFilter === 'general') return f.tournament_id === null;
    return f.tournament_id === tournamentFilter;
  });
  const visible = inTournament.filter((f) => {
    if (sentimentFilter === 'all') return true;
    if (sentimentFilter === 'pending') return f.sentiment === null;
    return f.sentiment === sentimentFilter;
  });

  const pendingCount = feedback.filter(isFeedbackRetryable).length;
  const classified = inTournament.filter((f) => f.sentiment !== null);
  const averageRating = inTournament.length
    ? inTournament.reduce((sum, f) => sum + f.rating, 0) / inTournament.length
    : 0;
  const countOf = (s: Sentiment) => classified.filter((f) => f.sentiment === s).length;
  const percentOf = (s: Sentiment) => (classified.length ? Math.round((countOf(s) / classified.length) * 100) : 0);

  const topicCounts = new Map<string, number>();
  for (const f of inTournament) {
    for (const t of f.topics) topicCounts.set(t, (topicCounts.get(t) || 0) + 1);
  }
  const topTopics = [...topicCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

  return (
    <div className="w-full space-y-8 uppercase">
      {/* 1. Main Hero Container with Official Banner */}
      <section className="relative w-full rounded-3xl border border-stone-800/80 bg-stone-950 overflow-hidden shadow-md p-8 sm:p-14 lg:p-16 text-center text-white flex flex-col items-center justify-center space-y-4">
        <PageHeroBackground specificKey="hero_banner_path" alt="DALTA Esports Feedback Banner" />

        <div className="relative z-10 w-full flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-black text-amber-400 hover:text-amber-300 uppercase tracking-wider transition-colors"
          >
            ← Back to Dashboard
          </Link>
          <button
            onClick={handleClassify}
            disabled={classifying || pendingCount === 0}
            className="bg-gold text-stone-950 px-5 py-2.5 rounded-xl font-black border border-amber-400 shadow-xs hover:bg-golddark hover:-translate-y-0.5 transition-all uppercase tracking-widest text-xs disabled:opacity-50 cursor-pointer"
          >
            {classifying ? 'Analyzing...' : `Analyze Pending Feedback (${pendingCount})`}
          </button>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto space-y-3 pt-2">
          <h1
            className="text-3xl sm:text-4xl lg:text-5xl font-black !text-white text-white tracking-wider uppercase leading-tight"
            style={{ color: '#ffffff' }}
          >
            Feedback Analysis
          </h1>
          <p
            className="text-base sm:text-lg !text-white text-stone-200 font-medium uppercase tracking-wide leading-relaxed"
            style={{ color: '#ffffff' }}
          >
            Participant sentiment, experience reviews, and satisfaction trends analyzed with Gemini AI.
          </p>
        </div>
      </section>

      {/* 2. Controls & Sentiment Analytics */}
      <div className="space-y-6 text-stone-950">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <ExportButtons
            type="feedback"
            label="Feedback"
            params={{ tournament: tournamentFilter === 'all' ? null : tournamentFilter }}
          />
        </div>

        {error && (
          <div role="alert" className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 text-xs font-bold tracking-wider shadow-2xs">
            {error}
          </div>
        )}
        {message && (
          <div role="status" className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-4 text-xs font-bold tracking-wider shadow-2xs">
            {message}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={tournamentFilter}
            onChange={(e) => setTournamentFilter(e.target.value)}
            className={`${inputClass} flex-1`}
            aria-label="Filter by tournament"
          >
            <option value="all">All Tournaments & General</option>
            <option value="general">General Feedback Only</option>
            {tournaments.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <select
            value={sentimentFilter}
            onChange={(e) => setSentimentFilter(e.target.value)}
            className={`${inputClass} sm:w-64`}
            aria-label="Filter by sentiment"
          >
            <option value="all">Any Sentiment</option>
            <option value="positive">Positive</option>
            <option value="neutral">Neutral</option>
            <option value="negative">Negative</option>
            <option value="pending">Pending Analysis</option>
          </select>
        </div>

        {/* Metrics Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white border border-stone-200/90 rounded-2xl p-5 shadow-xs space-y-1 text-stone-950">
            <span className="block text-xs uppercase font-black text-stone-500 tracking-wider">Total Feedback</span>
            <span className="text-2xl sm:text-3xl font-black text-stone-950">{inTournament.length}</span>
          </div>

          <div className="bg-white border border-stone-200/90 rounded-2xl p-5 shadow-xs space-y-1 text-stone-950">
            <span className="block text-xs uppercase font-black text-stone-500 tracking-wider">Avg Rating</span>
            <div className="flex items-center gap-1.5">
              <span className="text-2xl sm:text-3xl font-black text-stone-950">{averageRating ? averageRating.toFixed(1) : '–'}</span>
              <Star className="h-5 w-5 fill-amber-400 text-amber-500" />
            </div>
          </div>

          {(['positive', 'neutral', 'negative'] as Sentiment[]).map((s) => (
            <div
              key={s}
              className={`rounded-2xl border p-5 shadow-xs space-y-1 ${sentimentStyles[s]}`}
            >
              <span className="block text-xs uppercase font-black tracking-wider">{s}</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-black">{countOf(s)}</span>
                <span className="text-xs font-bold opacity-80">({percentOf(s)}%)</span>
              </div>
            </div>
          ))}
        </div>

        {/* Common Topics */}
        {topTopics.length > 0 && (
          <div className="bg-white border border-stone-200/90 rounded-2xl p-6 shadow-xs space-y-3 text-stone-950">
            <h3 className="text-xs uppercase font-black text-stone-600 tracking-wider">Top Topics Mentioned</h3>
            <div className="flex flex-wrap gap-2">
              {topTopics.map(([topic, count]) => (
                <span
                  key={topic}
                  className="px-3.5 py-1.5 rounded-full bg-stone-100 border border-stone-200 text-stone-800 text-xs font-black tracking-wider"
                >
                  {topic} <span className="text-amber-700 ml-1 font-bold">×{count}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Feedback List */}
        {visible.length === 0 && error ? null : visible.length === 0 ? (
          <p className="text-stone-500 border border-dashed border-stone-300 rounded-2xl p-12 text-center font-bold tracking-wider">
            {feedback.length === 0 ? 'No feedback recorded yet.' : 'No feedback matches these filters.'}
          </p>
        ) : (
          <ul className="space-y-4">
            {visible.map((f) => (
              <li
                key={f.id}
                className="bg-white border border-stone-200/90 rounded-2xl p-6 shadow-xs space-y-3 text-stone-950"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <StarRating value={f.rating} size="sm" />
                    {f.sentiment ? (
                      <span className={`px-3 py-0.5 rounded-full border text-[11px] font-black uppercase tracking-wider ${sentimentStyles[f.sentiment]}`}>
                        {f.sentiment} {f.sentiment_score !== null && `(${Number(f.sentiment_score).toFixed(2)})`}
                      </span>
                    ) : (
                      <span className="px-3 py-0.5 rounded-full border border-amber-300 bg-amber-50 text-amber-800 text-[11px] font-black uppercase tracking-wider">
                        Pending Analysis
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-stone-500 font-semibold tracking-wide">
                    {f.tournaments?.name ?? (f.target_removed ? 'Deleted tournament' : 'General')}
                    {f.matches && ` · Match ${f.matches.match_number} (round ${f.matches.round})`}
                    {' · '}{new Date(f.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                  </span>
                </div>

                <p className="text-stone-800 font-medium text-xs sm:text-sm normal-case leading-relaxed whitespace-pre-wrap break-words">
                  {f.comment}
                </p>

                {f.sentiment === null && f.analysis_error && (
                  <p className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 p-2.5 rounded-xl">
                    {isFeedbackRetryable(f)
                      ? `Pending retry (${f.analysis_attempts} attempts): ${f.analysis_error}`
                      : `Max attempts reached (${f.analysis_attempts}): ${f.analysis_error}`}
                  </p>
                )}

                {f.topics.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {f.topics.map((t) => (
                      <span
                        key={t}
                        className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-stone-100 text-stone-700 border border-stone-200 uppercase"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
