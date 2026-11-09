import { describe, expect, it } from 'vitest';
import { eventStartsAt, manilaToday, pickFeaturedEvent, stripDraftMarker, type SitePost } from './site';

const event = (over: Partial<SitePost>): SitePost => ({
  id: over.id ?? 'e',
  title: 'Event',
  description: '',
  image_path: null,
  event_date: null,
  link: null,
  display_order: 0,
  is_published: true,
  ...over,
});

describe('manilaToday', () => {
  it('is already the next day in Manila at 16:00 UTC', () => {
    expect(manilaToday(new Date('2026-11-08T16:00:00Z'))).toBe('2026-11-09');
    expect(manilaToday(new Date('2026-11-08T15:59:00Z'))).toBe('2026-11-08');
  });
});

describe('eventStartsAt', () => {
  it('is midnight Manila time (16:00 UTC the day before)', () => {
    expect(eventStartsAt('2026-12-05').toISOString()).toBe('2026-12-04T16:00:00.000Z');
  });
});

describe('pickFeaturedEvent', () => {
  const today = '2026-11-09';

  it('prefers the pinned event, even without a date', () => {
    const pinned = event({ id: 'pin', is_featured: true });
    const soon = event({ id: 'soon', event_date: '2026-11-10' });
    expect(pickFeaturedEvent([soon, pinned], today)?.id).toBe('pin');
  });

  it('otherwise takes the nearest upcoming event, today included', () => {
    const later = event({ id: 'later', event_date: '2026-12-01' });
    const todays = event({ id: 'today', event_date: '2026-11-09' });
    const past = event({ id: 'past', event_date: '2026-11-01' });
    expect(pickFeaturedEvent([later, past, todays], today)?.id).toBe('today');
  });

  it('ignores unpublished events, past events and events without a date', () => {
    const hidden = event({ id: 'hidden', is_published: false, is_featured: true, event_date: '2026-11-10' });
    const past = event({ id: 'past', event_date: '2026-10-01' });
    const tba = event({ id: 'tba' });
    expect(pickFeaturedEvent([hidden, past, tba], today)).toBeNull();
  });
});

describe('stripDraftMarker', () => {
  it('removes a leading (draft) marker in any case or bracket style', () => {
    expect(stripDraftMarker('(draft) DALTA Esports was founded')).toBe('DALTA Esports was founded');
    expect(stripDraftMarker('  (DRAFT): Our mission')).toBe('Our mission');
    expect(stripDraftMarker('[Draft] - Vision')).toBe('Vision');
  });
  it('leaves other text alone', () => {
    expect(stripDraftMarker('A draft of our plan (draft)')).toBe('A draft of our plan (draft)');
    expect(stripDraftMarker('')).toBe('');
  });
});
