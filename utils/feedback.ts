import type { Feedback } from '@/utils/types';

// Feedback stays "pending analysis" until sentiment is set. After this many
// failed attempts it stops being retried, so a permanently unclassifiable
// comment can't keep burning rate-limit slots (see /api/feedback/classify).
export const MAX_FEEDBACK_ANALYSIS_ATTEMPTS = 5;

export function isFeedbackRetryable(f: Pick<Feedback, 'sentiment' | 'analysis_attempts'>) {
  return f.sentiment === null && f.analysis_attempts < MAX_FEEDBACK_ANALYSIS_ATTEMPTS;
}
