import { describe, expect, it } from 'vitest';
import { isFeedbackRetryable, MAX_FEEDBACK_ANALYSIS_ATTEMPTS } from '@/utils/feedback';

describe('isFeedbackRetryable', () => {
  const row = (sentiment: string | null, analysis_attempts: number) =>
    ({ sentiment, analysis_attempts }) as Parameters<typeof isFeedbackRetryable>[0];

  it('retries pending feedback under the attempt cap', () => {
    expect(isFeedbackRetryable(row(null, 0))).toBe(true);
    expect(isFeedbackRetryable(row(null, MAX_FEEDBACK_ANALYSIS_ATTEMPTS - 1))).toBe(true);
  });
  it('stops retrying once the cap is reached', () => {
    expect(isFeedbackRetryable(row(null, MAX_FEEDBACK_ANALYSIS_ATTEMPTS))).toBe(false);
  });
  it('never retries classified feedback', () => {
    expect(isFeedbackRetryable(row('positive', 0))).toBe(false);
  });
});
