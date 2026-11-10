'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Flame, Loader2, ShieldAlert, Sparkles } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useRealtimeRefresh } from '@/utils/use-realtime-refresh';
import { formatTime } from '@/utils/tournaments';
import { getErrorMessage } from '@/utils/errors';
import {
  HYPE_LABELS, commentsPerMinute, hypeLevel, hypeScore, positiveShare, throttleTrailing,
  type HypeLevel, type StreamSentimentTimeline,
} from '@/utils/live-sentiment';
import ReportChart from '@/components/ReportChart';
import AutoUpdateBadge from '@/components/AutoUpdateBadge';
import { SectionLoading } from '@/components/PageLoading';

// Reload at most this often while comments keep coming (and always within this time)
const THROTTLE_MS = 5000;
// Fallback when Realtime is down or the stream is quiet
const POLL_MS = 30_000;
// The chart shows at most this many minutes (the most recent ones)
const MAX_POINTS = 90;

const LEVEL_STYLE: Record<HypeLevel, string> = {
  cold: 'text-sky-700',
  warming: 'text-amber-700',
  hyped: 'text-orange-700',
  fire: 'text-red-700',
};

// Live comment sentiment of one stream ("hype meter") for organizers: a 0-100 hype gauge, a
// stacked area chart of positive / neutral / negative comments per minute, and small stats.
// Data: get_stream_sentiment_timeline() (admin/staff only, counts only, no text or user ids).
// Updates: Realtime on stream_comment_activity (the only comment table in Realtime), reloading at
// most every 5 s, plus a 30 s poll. Shown only when can(role, 'stream.viewSentiment').
export default function LiveSentimentMeter({ streamId, title }: { streamId: string; title?: string }) {
  const [data, setData] = useState<StreamSentimentTimeline | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const { data: result, error: rpcError } = await createClient().rpc('get_stream_sentiment_timeline', {
      p_stream_id: streamId,
      p_bucket_seconds: 60,
    });
    if (rpcError) {
      setError(getErrorMessage(rpcError, 'Live sentiment could not be loaded.'));
      return;
    }
    setError('');
    setData(result as unknown as StreamSentimentTimeline);
  }, [streamId]);

  // One throttle per stream: a steady chat can't postpone the reload forever (useRealtimeRefresh
  // on its own debounces)
  const throttled = useMemo(() => throttleTrailing(() => { load(); }, THROTTLE_MS), [load]);

  useEffect(() => {
    // First load straight away (not throttled), then the 30 s fallback poll
    const first = setTimeout(load, 0);
    const poll = setInterval(load, POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(poll);
      throttled.cancel();
    };
  }, [load, throttled]);

  useRealtimeRefresh(
    `sentiment-${streamId}`,
    [{ table: 'stream_comment_activity', filter: `stream_id=eq.${streamId}` }],
    throttled.call,
    300,
  );

  if (error) return <p role="alert" className="text-sm font-bold text-red-700">{error}</p>;
  if (!data) return <SectionLoading label="Loading live sentiment..." />;

  const score = hypeScore(data.recent);
  const level = hypeLevel(score);
  const share = positiveShare(data.totals);
  const chart = minuteSeries(data);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-black uppercase tracking-widest text-stone-600">
          {title ? <>Live sentiment · <span className="text-stone-950">{title}</span></> : 'Live sentiment'}
        </p>
        <AutoUpdateBadge />
      </div>

      <div className="grid grid-cols-1 @3xl:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] gap-5 items-center">
        <HypeGauge score={score} level={level} />

        <dl className="grid grid-cols-2 @xl:grid-cols-4 gap-3">
          <Stat label="Comments / min" value={String(commentsPerMinute(data.recent))} hint={`last ${data.recent.minutes} min`} />
          <Stat label="Positive" value={share === null ? '–' : `${share}%`} hint={`of ${data.totals.positive + data.totals.neutral + data.totals.negative} analysed`} />
          <Stat label="Flagged" value={String(data.totals.flagged)} hint="profane or offensive" icon={<ShieldAlert className="size-3.5 text-red-700" aria-hidden="true" />} />
          <Stat
            label="Analyzing"
            value={String(data.analyzing)}
            hint={data.gave_up > 0 ? `${data.gave_up} couldn't be analysed` : 'waiting for the AI'}
            icon={data.analyzing > 0 ? <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none text-stone-500" aria-hidden="true" /> : undefined}
          />
        </dl>
      </div>

      {data.top_topics.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-black uppercase tracking-widest text-stone-600">Top topics · last 10 min</p>
          <ul className="flex flex-wrap gap-2">
            {data.top_topics.map((t) => (
              <li key={t.topic} className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs font-bold text-stone-800">
                <Sparkles className="size-3 text-maroon" aria-hidden="true" /> {t.topic}
                <span className="text-stone-500">· {t.total}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {chart.labels.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-300 p-6 text-center text-sm text-stone-600">
          No comments yet. The chart starts with the first comment.
        </p>
      ) : (
        <ReportChart
          type="line"
          stacked
          title="Comment sentiment per minute"
          labels={chart.labels}
          series={chart.series}
          categoryTitle="Time (PH)"
          valueTitle="Comments (count)"
          heightClass="h-56 sm:h-64"
        />
      )}

      <p className="text-xs text-stone-600">
        Only visible comments count. Analysis can lag a minute or two at busy moments: the AI checks
        up to 10 batches of 20 comments a minute, so new comments show as &quot;Analyzing&quot; first.
      </p>
    </div>
  );
}

// Half-circle gauge with a needle (rotates with a transform; still with reduced motion)
function HypeGauge({ score, level }: { score: number; level: HypeLevel }) {
  // -90deg = 0 (left), +90deg = 100 (right)
  const angle = -90 + (score / 100) * 180;
  return (
    <div className="flex flex-col items-center" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={score} aria-label={`Hype ${score} of 100: ${HYPE_LABELS[level]}`}>
      <div className="relative w-full max-w-[14rem] aspect-[2/1] overflow-hidden">
        <svg viewBox="0 0 200 100" className="absolute inset-0 size-full" aria-hidden="true">
          <defs>
            <linearGradient id="hype-arc" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#2a78d6" />
              <stop offset="45%" stopColor="#eda100" />
              <stop offset="75%" stopColor="#eb6834" />
              <stop offset="100%" stopColor="#e34948" />
            </linearGradient>
          </defs>
          <path d="M 12 100 A 88 88 0 0 1 188 100" fill="none" stroke="url(#hype-arc)" strokeWidth="16" strokeLinecap="round" />
        </svg>
        {/* The needle turns around the bottom middle */}
        <div
          className="hype-needle absolute bottom-0 left-1/2 h-[82%] w-1 -ml-0.5 origin-bottom rounded-full bg-stone-950"
          style={{ transform: `rotate(${angle}deg)` }}
          aria-hidden="true"
        />
        <div className="absolute bottom-0 left-1/2 size-4 -translate-x-1/2 translate-y-1/2 rounded-full bg-stone-950" aria-hidden="true" />
      </div>
      <p className="mt-3 text-4xl font-black tabular-nums text-stone-950">{score}</p>
      <p className={`inline-flex items-center gap-1 text-sm font-black uppercase tracking-widest ${LEVEL_STYLE[level]}`}>
        {level === 'fire' && <Flame className="size-4" aria-hidden="true" />}
        {HYPE_LABELS[level]}
      </p>
    </div>
  );
}

function Stat({ label, value, hint, icon }: { label: string; value: string; hint?: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 min-w-0">
      <dt className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-stone-600">{icon}{label}</dt>
      <dd className="mt-1 text-2xl font-black tabular-nums text-stone-950">{value}</dd>
      {hint && <dd className="text-[11px] text-stone-600 break-words">{hint}</dd>}
    </div>
  );
}

// Per-minute series from the first bucket to the latest, with quiet minutes filled in as zeros
// (otherwise the lines would jump straight across gaps), the last MAX_POINTS minutes only.
function minuteSeries(data: StreamSentimentTimeline) {
  if (data.buckets.length === 0) return { labels: [] as string[], series: [] };
  const step = data.bucket_seconds * 1000;
  const byStart = new Map(data.buckets.map((b) => [new Date(b.bucket_start).getTime(), b]));
  const first = new Date(data.buckets[0].bucket_start).getTime();
  const last = new Date(data.buckets[data.buckets.length - 1].bucket_start).getTime();
  const start = Math.max(first, last - (MAX_POINTS - 1) * step);
  const times: number[] = [];
  for (let t = start; t <= last; t += step) times.push(t);
  const pick = (key: 'positive' | 'neutral' | 'negative') => times.map((t) => byStart.get(t)?.[key] ?? 0);
  return {
    labels: times.map((t) => formatTime(t)),
    series: [
      { label: 'Negative', tone: 'negative' as const, data: pick('negative') },
      { label: 'Neutral', tone: 'neutral' as const, data: pick('neutral') },
      { label: 'Positive', tone: 'positive' as const, data: pick('positive') },
    ],
  };
}
