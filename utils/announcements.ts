// Announcements news feed (Phase 14, 202611092000_announcements_feed): categories, filters,
// excerpts, the NEW badge rule, relative times and the small rich-text format of the body.
// Plain code (no React), shared by the feed, the detail page, the editor and the tests.

import { formatMomentDate } from '@/utils/tournaments';
import { SITE_IMAGES_BUCKET } from '@/utils/site';

export const ANNOUNCEMENT_CATEGORIES = [
  'tournament', 'match_update', 'results', 'event', 'registration', 'stream', 'general', 'urgent',
] as const;
export type AnnouncementCategory = (typeof ANNOUNCEMENT_CATEGORIES)[number];

// Badge text and colors. Solid palette colors that dark mode doesn't remap (white text stays
// readable in both themes); urgent uses the red of the LIVE tag. The icons live in
// components/announcements/CategoryBadge.tsx.
export const CATEGORY_INFO: Record<AnnouncementCategory, { label: string; badge: string; gradient: string }> = {
  tournament:   { label: 'Tournament',   badge: 'bg-indigo-600 text-white',  gradient: 'from-indigo-950 via-indigo-800 to-ink' },
  match_update: { label: 'Match Update', badge: 'bg-sky-600 text-white',     gradient: 'from-sky-950 via-sky-800 to-ink' },
  results:      { label: 'Results',      badge: 'bg-gold text-ink',          gradient: 'from-ink via-maroondark to-golddark' },
  event:        { label: 'Event',        badge: 'bg-fuchsia-700 text-white', gradient: 'from-fuchsia-950 via-fuchsia-800 to-ink' },
  registration: { label: 'Registration', badge: 'bg-teal-700 text-white',    gradient: 'from-teal-950 via-teal-800 to-ink' },
  stream:       { label: 'Stream',       badge: 'bg-pink-600 text-white',    gradient: 'from-pink-950 via-pink-800 to-ink' },
  general:      { label: 'General',      badge: 'bg-ink text-white ring-1 ring-white/15', gradient: 'from-ink via-stone-900 to-maroondark' },
  urgent:       { label: 'Urgent',       badge: 'bg-red-600 text-white',     gradient: 'from-red-950 via-red-900 to-ink' },
};

export function categoryOf(value: string | null | undefined): AnnouncementCategory {
  return (ANNOUNCEMENT_CATEGORIES as readonly string[]).includes(value ?? '') ? (value as AnnouncementCategory) : 'general';
}

// Filter chips on the feed. Each chip covers one or more categories.
export const FEED_FILTERS = [
  { id: 'all', label: 'All', categories: null },
  { id: 'tournaments', label: 'Tournaments', categories: ['tournament', 'registration'] },
  { id: 'matches', label: 'Match Updates', categories: ['match_update'] },
  { id: 'results', label: 'Results', categories: ['results'] },
  { id: 'events', label: 'Events', categories: ['event'] },
  { id: 'streams', label: 'Streams', categories: ['stream'] },
] as const satisfies readonly { id: string; label: string; categories: readonly AnnouncementCategory[] | null }[];
export type FeedFilterId = (typeof FEED_FILTERS)[number]['id'];
export const FEED_FILTER_IDS = FEED_FILTERS.map((f) => f.id) as FeedFilterId[];

export const LINKED_TYPES = ['tournament', 'match', 'stream', 'event'] as const;
export type LinkedType = (typeof LINKED_TYPES)[number];

export const REACTIONS = ['hype', 'gg', 'heart'] as const;
export type ReactionKind = (typeof REACTIONS)[number];
export const REACTION_LABELS: Record<ReactionKind, string> = { hype: 'Hype', gg: 'GG', heart: 'Love it' };

export const MAX_PINNED = 3;
export const TITLE_MAX = 150;
export const BODY_MAX = 20000;
// NEW badge: the last 48 hours for everyone; for logged-in users, also unread posts of the last 14 days
export const NEW_FOR_MS = 48 * 60 * 60 * 1000;
export const UNREAD_NEW_FOR_MS = 14 * 24 * 60 * 60 * 1000;

// The row as the feed reads it (select('*') on announcements)
export interface FeedAnnouncement {
  id: string;
  title: string;
  body: string;
  category: string;
  cover_path: string | null;
  game_id: string | null;
  tournament_id: string | null;
  linked_type: string | null;
  linked_id: string | null;
  pinned: boolean;
  is_urgent: boolean;
  is_draft: boolean;
  publish_at: string;
  notified_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface ReactionCounts {
  hype: number;
  gg: number;
  heart: number;
  mine: ReactionKind[];
}

export const NO_REACTIONS: ReactionCounts = { hype: 0, gg: 0, heart: 0, mine: [] };

// Linked mini cards (get_announcement_links)
export interface LinkTeam { name: string; logo_url: string | null }
export type AnnouncementLink =
  | {
      type: 'tournament'; id: string; name: string; game: string; game_id: string | null;
      start_date: string; end_date: string; registration_deadline: string; status: 'upcoming' | 'cancelled';
      max_participants: number; registered: number;
    }
  | {
      type: 'match'; id: string; tournament_id: string; tournament_name: string; game: string; game_id: string | null;
      round: number; match_number: number; status: 'scheduled' | 'live' | 'completed'; scheduled_at: string | null;
      score_a: number | null; score_b: number | null; is_forfeit: boolean; winner: 'a' | 'b' | null;
      team_a: LinkTeam | null; team_b: LinkTeam | null;
    }
  | {
      type: 'stream'; id: string; title: string; status: 'scheduled' | 'live' | 'ended';
      tournament_id: string; tournament_name: string; game_id: string | null; match_id: string | null;
    }
  | {
      type: 'event'; id: string; title: string; event_date: string | null; venue: string | null;
      image_path: string | null; tournament_id: string | null;
    };

// Shown to the public = not a draft and its time has come (RLS already hides the rest from
// non-organizers; organizers see the labels "Draft" / "Scheduled")
export function isPublished(a: Pick<FeedAnnouncement, 'is_draft' | 'publish_at'>, now = Date.now()) {
  return !a.is_draft && new Date(a.publish_at).getTime() <= now;
}

export function isUrgent(a: Pick<FeedAnnouncement, 'is_urgent' | 'category'>) {
  return a.is_urgent || a.category === 'urgent';
}

// readIds = the logged-in user's read announcements (null = logged out)
export function isNewAnnouncement(
  a: Pick<FeedAnnouncement, 'id' | 'publish_at'>,
  readIds: ReadonlySet<string> | null,
  now = Date.now(),
) {
  const age = now - new Date(a.publish_at).getTime();
  if (age < 0) return false;
  if (readIds) return !readIds.has(a.id) && age <= UNREAD_NEW_FOR_MS;
  return age <= NEW_FOR_MS;
}

// "just now", "5 minutes ago", "2 hours ago", "yesterday", "3 days ago", then the date
export function relativeTime(value: string, now = Date.now()) {
  const diff = now - new Date(value).getTime();
  if (Number.isNaN(diff)) return '';
  if (diff < 0) return `on ${formatMomentDate(value)}`;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return formatMomentDate(value);
}

// Pinned first (newest pin first), then newest
export function sortFeed<T extends Pick<FeedAnnouncement, 'pinned' | 'publish_at'>>(rows: T[]): T[] {
  return [...rows].sort((x, y) => {
    if (x.pinned !== y.pinned) return x.pinned ? -1 : 1;
    return new Date(y.publish_at).getTime() - new Date(x.publish_at).getTime();
  });
}

export interface FeedQuery {
  filter: FeedFilterId;
  game: string; // '' = all games
  q: string;
}

export function matchesFeedQuery(a: FeedAnnouncement, { filter, game, q }: FeedQuery) {
  const chip = FEED_FILTERS.find((f) => f.id === filter);
  if (chip?.categories && !(chip.categories as readonly string[]).includes(categoryOf(a.category))) return false;
  if (game && a.game_id !== game) return false;
  const needle = q.trim().toLowerCase();
  if (needle && !`${a.title} ${plainText(a.body)}`.toLowerCase().includes(needle)) return false;
  return true;
}

// Featured hero cards: the pinned posts (max 3). Without pins, the newest post leads.
export function pickFeatured<T extends Pick<FeedAnnouncement, 'id' | 'pinned' | 'publish_at'>>(sorted: T[]): T[] {
  const pinned = sorted.filter((a) => a.pinned).slice(0, MAX_PINNED);
  if (pinned.length > 0) return pinned;
  return sorted.slice(0, 1);
}

// ---------------------------------------------------------------------------
// Rich text: a small, safe subset of Markdown, rendered by components/announcements/
// AnnouncementBody.tsx as React elements (never as HTML, so no script can get in).
//   ## Heading / ### Smaller heading
//   - item / * item (bulleted list), 1. item (numbered list)
//   > quote
//   **bold**, *italic*, [link text](https://... or /path)
//   ![description](image address)  -- only images uploaded to our site-images bucket
//   a Facebook video link alone on its line -> embedded player
// Paragraphs are separated by a blank line; single line breaks are kept. Old plain-text posts
// render as paragraphs, exactly as before.
// ---------------------------------------------------------------------------

export type InlineToken =
  | { type: 'text'; text: string }
  | { type: 'bold'; children: InlineToken[] }
  | { type: 'italic'; children: InlineToken[] }
  | { type: 'link'; href: string; children: InlineToken[] }
  | { type: 'break' };

export type RichBlock =
  | { type: 'heading'; level: 2 | 3; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'quote'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'image'; src: string; alt: string }
  | { type: 'video'; url: string };

const IMAGE_LINE = /^!\[([^\]]*)\]\(([^)\s]+)\)$/;
const FACEBOOK_LINE = /^https:\/\/(www\.|m\.|web\.)?(facebook\.com|fb\.watch)\/\S+$/i;
const BULLET = /^[-*]\s+(.*)$/;
const NUMBERED = /^\d{1,3}[.)]\s+(.*)$/;

// Images must come from our public bucket: the CSP only allows Supabase images, and outside
// addresses could track readers.
export function isAllowedImage(src: string, supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '') {
  if (!supabaseUrl) return false;
  return src.startsWith(`${supabaseUrl}/storage/v1/object/public/${SITE_IMAGES_BUCKET}/`) && !src.includes('..');
}

// Only our own pages and https addresses (no javascript:, data: or http:)
export function safeHref(href: string): string | null {
  const value = href.trim();
  if (/^\/(?!\/)/.test(value)) return value;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
}

export function parseRichText(body: string, supabaseUrl?: string): RichBlock[] {
  const blocks: RichBlock[] = [];
  const lines = body.replace(/\r\n?/g, '\n').split('\n');
  let paragraph: string[] = [];
  // Cast, so TypeScript doesn't narrow it to null inside the helper closures
  let list = null as { ordered: boolean; items: string[] } | null;

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: 'paragraph', text: paragraph.join('\n') });
    paragraph = [];
  };
  const flushList = () => {
    if (list) blocks.push({ type: 'list', ...list });
    list = null;
  };

  let previous = '';
  for (const raw of lines) {
    const line = raw.trim();
    const afterQuote = previous.startsWith('>');
    previous = line;
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = line.match(/^(#{2,3})\s+(.+)$/);
    const image = line.match(IMAGE_LINE);
    const bullet = line.match(BULLET);
    const numbered = line.match(NUMBERED);

    if (heading) {
      flushParagraph(); flushList();
      blocks.push({ type: 'heading', level: heading[1].length === 2 ? 2 : 3, text: heading[2].trim() });
    } else if (image && isAllowedImage(image[2], supabaseUrl)) {
      flushParagraph(); flushList();
      blocks.push({ type: 'image', src: image[2], alt: image[1].trim() });
    } else if (FACEBOOK_LINE.test(line)) {
      flushParagraph(); flushList();
      blocks.push({ type: 'video', url: line });
    } else if (line.startsWith('>')) {
      flushParagraph(); flushList();
      const text = line.replace(/^>\s?/, '');
      const last = blocks[blocks.length - 1];
      // Consecutive quote lines form one quote
      if (last?.type === 'quote' && afterQuote) last.text += `\n${text}`;
      else blocks.push({ type: 'quote', text });
    } else if (bullet || numbered) {
      flushParagraph();
      const ordered = !bullet;
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [] };
      }
      list.items.push((bullet ?? numbered)![1].trim());
    } else {
      flushList();
      paragraph.push(line);
    }
  }
  flushParagraph();
  flushList();
  return blocks;
}

// **bold**, *italic*, [text](href) and line breaks. Unsafe links stay plain text.
export function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  const pattern = /\*\*(.+?)\*\*|\*(?!\s)(.+?)\*|\[([^\]]+)\]\(([^)\s]+)\)|\n/g;
  let last = 0;
  for (const m of text.matchAll(pattern)) {
    if (m.index > last) tokens.push({ type: 'text', text: text.slice(last, m.index) });
    if (m[0] === '\n') tokens.push({ type: 'break' });
    else if (m[1] !== undefined) tokens.push({ type: 'bold', children: parseInline(m[1]) });
    else if (m[2] !== undefined) tokens.push({ type: 'italic', children: parseInline(m[2]) });
    else {
      const href = safeHref(m[4]);
      if (href) tokens.push({ type: 'link', href, children: parseInline(m[3]) });
      else tokens.push({ type: 'text', text: m[0] });
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) tokens.push({ type: 'text', text: text.slice(last) });
  return tokens;
}

// The body without formatting marks, for excerpts, search and link previews
export function plainText(body: string) {
  return body
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => !IMAGE_LINE.test(line) && !FACEBOOK_LINE.test(line))
    .map((line) => line.replace(/^#{2,3}\s+/, '').replace(/^[-*>]\s+/, '').replace(/^\d{1,3}[.)]\s+/, ''))
    .join(' ')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(?!\s)(.+?)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)\s]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

export function excerptOf(body: string, max = 200) {
  const text = plainText(body);
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:–-]+$/, '')}…`;
}

// About 200 words per minute; at least 1
export function readingMinutes(body: string) {
  const words = plainText(body).split(' ').filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

// Up to `count` related posts: same tournament or game first, then same category, then newest
export function relatedAnnouncements<T extends FeedAnnouncement>(current: T, all: T[], count = 3): T[] {
  const score = (a: T) =>
    (current.tournament_id && a.tournament_id === current.tournament_id ? 4 : 0) +
    (current.game_id && a.game_id === current.game_id ? 2 : 0) +
    (a.category === current.category ? 1 : 0);
  return all
    .filter((a) => a.id !== current.id)
    .sort((x, y) => score(y) - score(x) || new Date(y.publish_at).getTime() - new Date(x.publish_at).getTime())
    .slice(0, count);
}

// Which category fits a link, as a suggestion in the editor (the admin can change it)
export function suggestedCategory(linkedType: LinkedType | '', matchFinished = false): AnnouncementCategory | null {
  if (linkedType === 'match') return matchFinished ? 'results' : 'match_update';
  if (linkedType === 'stream') return 'stream';
  if (linkedType === 'event') return 'event';
  if (linkedType === 'tournament') return 'tournament';
  return null;
}

// The feed's address with its filters, so "Back" from a post returns to the same view
export function feedHref({ filter, game, q }: FeedQuery) {
  const params = new URLSearchParams();
  if (filter !== 'all') params.set('filter', filter);
  if (game) params.set('game', game);
  if (q.trim()) params.set('q', q.trim());
  const query = params.toString();
  return query ? `/announcements?${query}` : '/announcements';
}

// Urgent banner: which urgent post to show (the newest one this browser hasn't dismissed)
export function urgentToShow<T extends Pick<FeedAnnouncement, 'id' | 'publish_at'>>(rows: T[], dismissed: readonly string[]): T | null {
  return [...rows]
    .sort((x, y) => new Date(y.publish_at).getTime() - new Date(x.publish_at).getTime())
    .find((a) => !dismissed.includes(a.id)) ?? null;
}
