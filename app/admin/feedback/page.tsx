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
import PageLoading from '@/components/PageLoading';
import PageError from '@/components/PageError';

const inputClass =
  'border border-brownlight bg-sitebg px-4 py-2 text-white outline-none focus:border-gold';

const sentimentStyles: Record<Sentiment, string> = {
  positive: 'bg-green-500/15 text-green-300 border-green-500/50',
  neutral: 'bg-gray-500/15 text-gray-300 border-gray-500/50',
  negative: 'bg-red-500/15 text-red-300 border-red-500/50',
};

// Asks the server to retry one batch of "pending analysis" feedback with Gemini.
// reason = why some are still pending (Gemini down, limit reached, ...), or null.
async function runClassification(): Promise<{ classified: number; remaining: number; reason: string | null }> {
  const response = await fetch('/api/feedback/classify', { method: 'POST' });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'The retry failed. Please try again.');
  return body;
}

// "Classify sentiment" (use case, Organizing Committee): feedback list and sentiment summary
export default function FeedbackAnalysisPage() {
  const supabase = createClient();
  usePageTitle('Feedback');
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [tournaments, setTournaments] = useState<Pick<Tournament, 'id' | 'name'>[]>([]);
  const [role, setRole] = useState('');
  // 'all', 'general' or a tournament id
  const [tournamentFilter, setTournamentFilter] = useState('all');
  // 'all', a sentiment, or 'pending'
  const [sentimentFilter, setSentimentFilter] = useState('all');
  const [classifying, setClassifying] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  // Increase this to make the effect below load everything again
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
        // New feedback is classified when it's sent, so opening this page doesn't call Gemini
        // (that used to spend the free quota on every visit). Pending ones are retried with the button.

        const { data: tournamentsData, error: tourError } = await supabase
          .from('tournaments')
          .select('id, name')
          .order('start_date', { ascending: false });
        if (tourError) throw tourError;
        setTournaments(tournamentsData || []);

        const { data, error: fbError } = await supabase
          .from('feedback')
          .select('*, tournaments(id, name), matches(id, round, match_number)')
          .order('created_at', { ascending: false });
        if (fbError) throw fbError;
        setFeedback(data || []);
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

  // Hiding the page is only for convenience; RLS returns only their own feedback to other roles.
  // The role couldn't be loaded: show why, not "only admins"
  if (!role && error) return <PageError message={error} />;
  if (role !== 'admin') {
    return (
      <main id="main-content" className="min-h-screen bg-sitebg text-white p-10 text-center">
        Only admins can view the feedback analysis.{' '}
        <Link href="/feedback" className="text-gold underline">Send feedback instead</Link>
      </main>
    );
  }

  // Summary uses the tournament filter; the list below also uses the sentiment filter.
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

  // Retryable = still pending and under the attempt cap; rows at the cap are
  // left alone (see isFeedbackRetryable) so they don't burn rate-limit slots.
  const pendingCount = feedback.filter(isFeedbackRetryable).length;
  const classified = inTournament.filter((f) => f.sentiment !== null);
  const averageRating = inTournament.length
    ? inTournament.reduce((sum, f) => sum + f.rating, 0) / inTournament.length
    : 0;
  const countOf = (s: Sentiment) => classified.filter((f) => f.sentiment === s).length;
  const percentOf = (s: Sentiment) => (classified.length ? Math.round((countOf(s) / classified.length) * 100) : 0);

  // "Common concerns": the topics mentioned most often
  const topicCounts = new Map<string, number>();
  for (const f of inTournament) {
    for (const t of f.topics) topicCounts.set(t, (topicCounts.get(t) || 0) + 1);
  }
  const topTopics = [...topicCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

  return (
    <main id="main-content" className="min-h-screen bg-sitebg text-white px-4 py-10">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <Link href="/dashboard" className="inline-block text-gold hover:underline mb-6">
            ← Back to Dashboard
          </Link>
          <div className="flex flex-wrap justify-between items-center gap-4">
            <h1 className="font-pixel text-xl sm:text-2xl leading-relaxed text-gold">Feedback Analysis</h1>
            <button
              onClick={handleClassify}
              disabled={classifying || pendingCount === 0}
              className="bg-gold text-black px-6 py-2 font-bold hover:bg-golddark transition disabled:opacity-50"
            >
              {classifying ? 'Retrying...' : `Retry pending analysis (${pendingCount})`}
            </button>
          </div>
          <p className="text-gray-400 text-sm mt-2">
            Sentiment is classified by Google Gemini when feedback is sent. If Gemini was down or the limit was
            reached, the feedback waits here as &quot;pending analysis&quot;.
          </p>
          {/* Uses the tournament filter below; exports don't include who wrote the feedback */}
          <div className="mt-3">
            <ExportButtons
              type="feedback"
              label="Feedback"
              params={{ tournament: tournamentFilter === 'all' ? null : tournamentFilter }}
            />
          </div>
        </div>

        {error && <div role="alert" className="bg-red-500/10 border border-red-500 text-red-300 px-4 py-3">{error}</div>}
        {message && <div role="status" className="bg-green-500/10 border border-green-500 text-green-300 px-4 py-3">{message}</div>}

        <div className="flex flex-col sm:flex-row gap-3">
          <select value={tournamentFilter} onChange={(e) => setTournamentFilter(e.target.value)} className={`${inputClass} flex-1`} aria-label="Filter by tournament">
            <option value="all">All feedback</option>
            <option value="general">General only</option>
            {tournaments.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <select value={sentimentFilter} onChange={(e) => setSentimentFilter(e.target.value)} className={inputClass} aria-label="Filter by sentiment">
            <option value="all">Any sentiment</option>
            <option value="positive">Positive</option>
            <option value="neutral">Neutral</option>
            <option value="negative">Negative</option>
            <option value="pending">Pending analysis</option>
          </select>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-sitecard border border-brownlight p-4">
            <p className="text-xs uppercase font-bold text-gray-400">Feedback</p>
            <p className="text-2xl font-bold">{inTournament.length}</p>
          </div>
          <div className="bg-sitecard border border-brownlight p-4">
            <p className="text-xs uppercase font-bold text-gray-400">Avg rating</p>
            <p className="text-2xl font-bold">{averageRating ? averageRating.toFixed(1) : '–'} <span className="text-yellow-400 text-lg">★</span></p>
          </div>
          {(['positive', 'neutral', 'negative'] as Sentiment[]).map((s) => (
            <div key={s} className={`border p-4 ${sentimentStyles[s]}`}>
              <p className="text-xs uppercase font-bold">{s}</p>
              <p className="text-2xl font-bold">{countOf(s)} <span className="text-sm font-normal">({percentOf(s)}%)</span></p>
            </div>
          ))}
        </div>

        {topTopics.length > 0 && (
          <div className="bg-sitecard border border-brownlight p-4">
            <p className="text-xs uppercase font-bold text-gray-400 mb-2">Most mentioned topics</p>
            <div className="flex flex-wrap gap-2">
              {topTopics.map(([topic, count]) => (
                <span key={topic} className="px-3 py-1 rounded-full bg-gold/10 border border-brownlight text-sm">
                  {topic} <span className="text-gray-400">×{count}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Feedback list */}
        {/* A failed load shows the error above, not "nothing here" */}
        {visible.length === 0 && error ? null : visible.length === 0 ? (
          <p className="text-gray-400 border-2 border-dashed border-brown p-6 text-center">
            {feedback.length === 0 ? 'No feedback yet.' : 'No feedback matches these filters.'}
          </p>
        ) : (
          <ul className="space-y-3">
            {visible.map((f) => (
              <li key={f.id} className="bg-sitecard border border-brown p-4">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <StarRating value={f.rating} size="sm" />
                  {f.sentiment ? (
                    <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase ${sentimentStyles[f.sentiment]}`}>
                      {f.sentiment} {f.sentiment_score !== null && `(${Number(f.sentiment_score).toFixed(2)})`}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full border border-yellow-500/50 text-yellow-300 text-[10px] font-bold uppercase">
                      Pending analysis
                    </span>
                  )}
                  <span className="text-xs text-gray-400 ml-auto">
                    {f.tournaments?.name ?? (f.target_removed ? 'Deleted tournament' : 'General')}
                    {f.matches && ` · Match ${f.matches.match_number} (round ${f.matches.round})`}
                    {' · '}{new Date(f.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                  </span>
                </div>
                <p className="text-gray-200 whitespace-pre-wrap break-words">{f.comment}</p>
                {f.sentiment === null && f.analysis_error && (
                  <p className="mt-1 text-xs text-yellow-300/80">
                    {isFeedbackRetryable(f)
                      ? `Last try failed (${f.analysis_attempts}×): ${f.analysis_error}`
                      : `Gave up after ${f.analysis_attempts} tries: ${f.analysis_error}`}
                  </p>
                )}
                {f.topics.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {f.topics.map((t) => (
                      <span key={t} className="text-xs px-2 py-0.5 bg-sitebg text-gray-400 border border-gray-700">{t}</span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
