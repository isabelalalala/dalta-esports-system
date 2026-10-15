'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import type { Feedback, Sentiment, Tournament } from '@/utils/types';
import StarRating from '@/components/StarRating';
import ExportButtons from '@/components/ExportButtons';

const inputClass =
  'border border-brownlight bg-sitebg px-4 py-2 text-white outline-none focus:border-gold';

const sentimentStyles: Record<Sentiment, string> = {
  positive: 'bg-green-500/15 text-green-300 border-green-500/50',
  neutral: 'bg-gray-500/15 text-gray-300 border-gray-500/50',
  negative: 'bg-red-500/15 text-red-300 border-red-500/50',
};

// Asks the server to classify one batch of unclassified feedback with Gemini.
async function runClassification(): Promise<{ classified: number; remaining: number }> {
  const response = await fetch('/api/feedback/classify', { method: 'POST' });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Classification failed.');
  return body;
}

// "Classify sentiment" (use case, Organizing Committee): feedback list and sentiment summary
export default function FeedbackAnalysisPage() {
  const supabase = createClient();
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

        const { data: profileData } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();
        setRole(profileData?.role ?? '');
        if (profileData?.role !== 'admin') return;

        // On the first load, classify one batch of new feedback automatically
        if (reloadCount === 0) {
          try {
            const result = await runClassification();
            if (result.classified > 0) setMessage(`Classified ${result.classified} new feedback.`);
          } catch (err) {
            setError(getErrorMessage(err, 'Automatic classification failed'));
          }
        }

        const { data: tournamentsData, error: tourError } = await supabase
          .from('tournaments')
          .select('id, name')
          .order('start_date', { ascending: false });
        if (tourError) throw tourError;
        setTournaments(tournamentsData || []);

        const { data, error: fbError } = await supabase
          .from('feedback')
          .select('*, tournaments(id, name)')
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
      setMessage(
        result.remaining > 0
          ? `Classified ${result.classified}. ${result.remaining} still pending; click again for the next batch.`
          : `Classified ${result.classified}. All feedback is classified.`
      );
      setReloadCount((n) => n + 1);
    } catch (err) {
      setError(getErrorMessage(err, 'Classification failed'));
    } finally {
      setClassifying(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-sitebg text-white p-10 text-center">Loading...</div>;

  // Hiding the page is only for convenience; RLS returns only their own feedback to other roles.
  if (role !== 'admin') {
    return (
      <div className="min-h-screen bg-sitebg text-white p-10 text-center">
        Only admins can view the feedback analysis.{' '}
        <Link href="/feedback" className="text-gold underline">Send feedback instead</Link>
      </div>
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

  const pendingCount = feedback.filter((f) => f.sentiment === null).length;
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
    <div className="min-h-screen bg-sitebg text-white px-4 py-10">
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
              {classifying ? 'Classifying...' : `Classify now (${pendingCount} pending)`}
            </button>
          </div>
          <p className="text-gray-400 text-sm mt-2">Sentiment is classified by Google Gemini.</p>
          {/* Uses the tournament filter below; exports don't include who wrote the feedback */}
          <div className="mt-3">
            <ExportButtons
              type="feedback"
              label="Feedback"
              params={{ tournament: tournamentFilter === 'all' ? null : tournamentFilter }}
            />
          </div>
        </div>

        {error && <div className="bg-red-500/10 border border-red-500 text-red-300 px-4 py-3">{error}</div>}
        {message && <div className="bg-green-500/10 border border-green-500 text-green-300 px-4 py-3">{message}</div>}

        <div className="flex flex-col sm:flex-row gap-3">
          <select value={tournamentFilter} onChange={(e) => setTournamentFilter(e.target.value)} className={`${inputClass} flex-1`}>
            <option value="all">All feedback</option>
            <option value="general">General only</option>
            {tournaments.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <select value={sentimentFilter} onChange={(e) => setSentimentFilter(e.target.value)} className={inputClass}>
            <option value="all">Any sentiment</option>
            <option value="positive">Positive</option>
            <option value="neutral">Neutral</option>
            <option value="negative">Negative</option>
            <option value="pending">Not classified yet</option>
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
        {visible.length === 0 ? (
          <p className="text-gray-400 text-center py-12">No feedback matches.</p>
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
                      Pending
                    </span>
                  )}
                  <span className="text-xs text-gray-500 ml-auto">
                    {f.tournaments?.name ?? 'General'} · {new Date(f.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                  </span>
                </div>
                <p className="text-gray-200 whitespace-pre-wrap">{f.comment}</p>
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
    </div>
  );
}
