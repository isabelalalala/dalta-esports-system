// Live sentiment "hype meter" (components/LiveSentimentMeter.tsx): the shape returned by
// get_stream_sentiment_timeline() (202611101000_live_sentiment) and the hype score formula.
// Plain code, shared by the component and the tests.

export interface SentimentBucket {
  bucket_start: string; // timestamptz (show in PH time with formatTime())
  total: number;
  positive: number;
  neutral: number;
  negative: number;
  analyzing: number;
  flagged: number;
  avg_score: number | null;
}

export interface SentimentCounts {
  total: number;
  positive: number;
  neutral: number;
  negative: number;
}

export interface StreamSentimentTimeline {
  bucket_seconds: number;
  since: string;
  generated_at: string;
  buckets: SentimentBucket[];
  totals: SentimentCounts & { flagged: number; avg_score: number | null };
  // The last `minutes` minutes: the input of hypeScore()
  recent: SentimentCounts & { minutes: number };
  top_topics: { topic: string; total: number }[];
  analyzing: number;
  gave_up: number;
}

// Comments per minute that count as a full house: from this rate on, the chat is as busy as it gets
const FULL_RATE_PER_MINUTE = 20;

// The hype score, 0-100:
//   intensity = min(1, comments per minute in the recent window / 20)      (how busy the chat is)
//   mood      = (share positive - share negative + 1) / 2                  (0 = all negative, 1 = all positive)
//   hype      = round(100 x intensity x mood)
// Shares are taken over the analysed comments only (positive + neutral + negative); while nothing
// is analysed yet the mood counts as neutral (0.5), so a busy chat still warms the meter up.
export function hypeScore(recent: SentimentCounts & { minutes: number }): number {
  const minutes = recent.minutes > 0 ? recent.minutes : 1;
  const intensity = Math.min(1, recent.total / minutes / FULL_RATE_PER_MINUTE);
  const analysed = recent.positive + recent.neutral + recent.negative;
  const net = analysed > 0 ? (recent.positive - recent.negative) / analysed : 0;
  const mood = (net + 1) / 2;
  return Math.round(100 * intensity * mood);
}

export type HypeLevel = 'cold' | 'warming' | 'hyped' | 'fire';

export const HYPE_LABELS: Record<HypeLevel, string> = {
  cold: 'Cold',
  warming: 'Warming up',
  hyped: 'Hyped',
  fire: 'On fire',
};

// 0-24 Cold, 25-49 Warming up, 50-74 Hyped, 75-100 On fire
export function hypeLevel(score: number): HypeLevel {
  if (score >= 75) return 'fire';
  if (score >= 50) return 'hyped';
  if (score >= 25) return 'warming';
  return 'cold';
}

// Comments per minute over the recent window, one decimal ("4.2")
export function commentsPerMinute(recent: { total: number; minutes: number }): number {
  return recent.minutes > 0 ? Math.round((recent.total / recent.minutes) * 10) / 10 : 0;
}

// Share of the analysed comments that are positive, as a whole percent; null when none are analysed
export function positiveShare(c: SentimentCounts): number | null {
  const analysed = c.positive + c.neutral + c.negative;
  return analysed > 0 ? Math.round((c.positive / analysed) * 100) : null;
}

// Runs `fn` at most once per `ms`, but always within `ms` of the first call (a throttle with a
// trailing call). useRealtimeRefresh debounces, which a steady chat (a comment every few seconds)
// would keep postponing forever; the meter wraps its reload in this instead.
export function throttleTrailing(fn: () => void, ms: number): { call: () => void; cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let last = 0;
  return {
    call() {
      if (timer) return; // a reload is already scheduled
      const wait = Math.max(0, last + ms - Date.now());
      timer = setTimeout(() => {
        timer = null;
        last = Date.now();
        fn();
      }, wait);
    },
    cancel() {
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}
