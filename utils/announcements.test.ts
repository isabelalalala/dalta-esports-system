import { describe, expect, it } from 'vitest';
import {
  categoryOf, excerptOf, feedHref, isAllowedImage, isNewAnnouncement, isPublished, matchesFeedQuery,
  parseInline, parseRichText, pickFeatured, plainText, relatedAnnouncements, relativeTime, safeHref,
  sortFeed, suggestedCategory, urgentToShow, type FeedAnnouncement,
} from './announcements';

const SB = 'https://abc.supabase.co';
const NOW = new Date('2026-11-09T12:00:00Z').getTime();
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();

function row(over: Partial<FeedAnnouncement> = {}): FeedAnnouncement {
  return {
    id: 'a1', title: 'Title', body: 'Body', category: 'general', cover_path: null, game_id: null,
    tournament_id: null, linked_type: null, linked_id: null, pinned: false, is_urgent: false,
    is_draft: false, publish_at: hoursAgo(1), notified_at: hoursAgo(1), created_at: hoursAgo(1),
    updated_at: hoursAgo(1), created_by: null, ...over,
  };
}

describe('categoryOf', () => {
  it('keeps known categories and falls back to general', () => {
    expect(categoryOf('results')).toBe('results');
    expect(categoryOf('nope')).toBe('general');
    expect(categoryOf(null)).toBe('general');
  });
});

describe('isPublished / isNewAnnouncement', () => {
  it('hides drafts and future posts', () => {
    expect(isPublished(row(), NOW)).toBe(true);
    expect(isPublished(row({ is_draft: true }), NOW)).toBe(false);
    expect(isPublished(row({ publish_at: hoursAgo(-2) }), NOW)).toBe(false);
  });

  it('logged out: new for 48 hours', () => {
    expect(isNewAnnouncement(row({ publish_at: hoursAgo(47) }), null, NOW)).toBe(true);
    expect(isNewAnnouncement(row({ publish_at: hoursAgo(49) }), null, NOW)).toBe(false);
  });

  it('logged in: new while unread (up to 14 days)', () => {
    expect(isNewAnnouncement(row({ publish_at: hoursAgo(100) }), new Set(), NOW)).toBe(true);
    expect(isNewAnnouncement(row({ publish_at: hoursAgo(1) }), new Set(['a1']), NOW)).toBe(false);
    expect(isNewAnnouncement(row({ publish_at: hoursAgo(24 * 15) }), new Set(), NOW)).toBe(false);
  });
});

describe('relativeTime', () => {
  it('reads like a feed', () => {
    expect(relativeTime(hoursAgo(0), NOW)).toBe('just now');
    expect(relativeTime(new Date(NOW - 5 * 60_000).toISOString(), NOW)).toBe('5 minutes ago');
    expect(relativeTime(hoursAgo(1), NOW)).toBe('1 hour ago');
    expect(relativeTime(hoursAgo(30), NOW)).toBe('yesterday');
    expect(relativeTime(hoursAgo(72), NOW)).toBe('3 days ago');
    expect(relativeTime(hoursAgo(24 * 10), NOW)).toMatch(/Oct 30, 2026/);
  });
});

describe('sortFeed / pickFeatured', () => {
  it('puts pinned first, then newest', () => {
    const rows = [row({ id: 'old', publish_at: hoursAgo(5) }), row({ id: 'pin', pinned: true, publish_at: hoursAgo(50) }), row({ id: 'new' })];
    expect(sortFeed(rows).map((r) => r.id)).toEqual(['pin', 'new', 'old']);
  });

  it('features pinned posts, or the newest one', () => {
    expect(pickFeatured(sortFeed([row({ id: 'x' }), row({ id: 'p', pinned: true })])).map((r) => r.id)).toEqual(['p']);
    expect(pickFeatured([row({ id: 'x' }), row({ id: 'y' })]).map((r) => r.id)).toEqual(['x']);
    expect(pickFeatured([])).toEqual([]);
  });
});

describe('matchesFeedQuery', () => {
  const r = row({ category: 'registration', game_id: 'mlbb', title: 'Season 3 signups', body: 'Register **now**' });
  it('filters by chip, game and search', () => {
    expect(matchesFeedQuery(r, { filter: 'all', game: '', q: '' })).toBe(true);
    expect(matchesFeedQuery(r, { filter: 'tournaments', game: '', q: '' })).toBe(true);
    expect(matchesFeedQuery(r, { filter: 'results', game: '', q: '' })).toBe(false);
    expect(matchesFeedQuery(r, { filter: 'all', game: 'valorant', q: '' })).toBe(false);
    expect(matchesFeedQuery(r, { filter: 'all', game: 'mlbb', q: 'register now' })).toBe(true);
    expect(matchesFeedQuery(r, { filter: 'all', game: '', q: 'finals' })).toBe(false);
  });
});

describe('rich text', () => {
  it('parses headings, lists, quotes and paragraphs', () => {
    const blocks = parseRichText('## Schedule\nDay 1\nDay 2\n\n- one\n- two\n1. first\n> note\n> more', SB);
    expect(blocks).toEqual([
      { type: 'heading', level: 2, text: 'Schedule' },
      { type: 'paragraph', text: 'Day 1\nDay 2' },
      { type: 'list', ordered: false, items: ['one', 'two'] },
      { type: 'list', ordered: true, items: ['first'] },
      { type: 'quote', text: 'note\nmore' },
    ]);
  });

  it('keeps only images from our bucket and embeds Facebook links', () => {
    const ours = `${SB}/storage/v1/object/public/site-images/announcements/x.webp`;
    const blocks = parseRichText(`![Poster](${ours})\n![Bad](https://evil.example/x.png)\nhttps://www.facebook.com/dalta/videos/12345678/`, SB);
    expect(blocks[0]).toEqual({ type: 'image', src: ours, alt: 'Poster' });
    expect(blocks[1]).toEqual({ type: 'paragraph', text: '![Bad](https://evil.example/x.png)' });
    expect(blocks[2]).toEqual({ type: 'video', url: 'https://www.facebook.com/dalta/videos/12345678/' });
  });

  it('old plain-text posts stay paragraphs', () => {
    expect(parseRichText('Hello everyone.\nSee you!', SB)).toEqual([{ type: 'paragraph', text: 'Hello everyone.\nSee you!' }]);
  });

  it('parses inline marks and refuses unsafe links', () => {
    expect(parseInline('a **b** *c* [d](/t/1)')).toEqual([
      { type: 'text', text: 'a ' },
      { type: 'bold', children: [{ type: 'text', text: 'b' }] },
      { type: 'text', text: ' ' },
      { type: 'italic', children: [{ type: 'text', text: 'c' }] },
      { type: 'text', text: ' ' },
      { type: 'link', href: '/t/1', children: [{ type: 'text', text: 'd' }] },
    ]);
    expect(parseInline('[x](javascript:alert(1))')[0].type).toBe('text');
    expect(safeHref('http://x.com')).toBeNull();
    expect(safeHref('//evil.com')).toBeNull();
    expect(safeHref('https://x.com/a')).toBe('https://x.com/a');
    expect(isAllowedImage(`${SB}/storage/v1/object/public/site-images/../avatars/x.png`, SB)).toBe(false);
  });

  it('makes plain excerpts', () => {
    expect(plainText('## Hi\n- **bold** item\n[link](/x)')).toBe('Hi bold item link');
    expect(excerptOf('word '.repeat(100), 30).endsWith('…')).toBe(true);
    expect(excerptOf('Short post.')).toBe('Short post.');
  });
});

describe('helpers', () => {
  it('related posts prefer the same tournament and game', () => {
    const cur = row({ id: 'c', tournament_id: 't1', game_id: 'mlbb' });
    const all = [cur, row({ id: 'x' }), row({ id: 'g', game_id: 'mlbb' }), row({ id: 't', tournament_id: 't1' })];
    expect(relatedAnnouncements(cur, all).map((r) => r.id)).toEqual(['t', 'g', 'x']);
  });

  it('suggests a category from the link', () => {
    expect(suggestedCategory('match', true)).toBe('results');
    expect(suggestedCategory('match')).toBe('match_update');
    expect(suggestedCategory('')).toBeNull();
  });

  it('builds the feed address with filters', () => {
    expect(feedHref({ filter: 'all', game: '', q: '' })).toBe('/announcements');
    expect(feedHref({ filter: 'results', game: 'mlbb', q: ' finals ' })).toBe('/announcements?filter=results&game=mlbb&q=finals');
  });

  it('shows the newest urgent post not dismissed', () => {
    const rows = [row({ id: 'u1', publish_at: hoursAgo(5) }), row({ id: 'u2', publish_at: hoursAgo(1) })];
    expect(urgentToShow(rows, [])?.id).toBe('u2');
    expect(urgentToShow(rows, ['u2'])?.id).toBe('u1');
    expect(urgentToShow(rows, ['u1', 'u2'])).toBeNull();
  });
});
