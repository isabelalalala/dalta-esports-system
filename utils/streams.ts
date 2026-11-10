import type { StreamStatus } from '@/utils/types';

// Facebook Live helpers. Videos are played with Facebook's embedded video player
// (plugins/video.php), which needs no API key but only renders public video posts.
//
// Staff paste many kinds of links. parseFacebookInput() sorts them into:
//   - video:          a link we can embed; turned into one canonical address + the video id
//   - needs-resolve:  a short link (/share/v/, /share/r/, fb.watch) that only redirects to the
//                     video; the server follows it (POST /api/streams/resolve-url)
//   - invalid:        anything else, with a message saying what to paste instead

const FB_HOST = /^(www\.|m\.|web\.|mbasic\.)?facebook\.com$/i;
const DIGITS = /^\d{5,}$/;

// Same rule as the CHECK constraint on streams.facebook_url (202610181310_facebook_video_check).
const FACEBOOK_VIDEO_URL =
  /^https:\/\/(www\.|m\.|web\.)?facebook\.com\/(watch[/?#]|reel\/|story\.php\?|[^/?#]+\/(videos|live)([/?#]|$))/i;

// Shown when a short link can't be followed (Facebook often shows servers a login page)
export const FACEBOOK_LINK_HELP =
  'We couldn\'t open that share link. On Facebook, open the video on its own page, click ⋯ → "Copy link" ' +
  '(not the Share button), and paste that link here. It should contain /videos/ or /watch/?v=.';

export type ParsedFacebookLink =
  | { kind: 'video'; canonicalUrl: string; videoId: string | null }
  | { kind: 'needs-resolve'; url: string }
  | { kind: 'invalid'; message: string };

// Embed code (<iframe src=".../plugins/video.php?href=...">) or a plugin URL -> the video link inside it
function unwrapEmbed(input: string): string {
  let value = input.trim();
  const src = value.match(/<iframe[^>]*\ssrc=["']([^"']+)["']/i);
  if (src) value = src[1].replace(/&amp;/g, '&');
  try {
    const u = new URL(value);
    if (FB_HOST.test(u.hostname) && u.pathname.startsWith('/plugins/video.php')) {
      const href = u.searchParams.get('href');
      if (href) return href.trim();
    }
  } catch {
    // not a URL: handled by the caller
  }
  return value;
}

export function parseFacebookInput(input: string): ParsedFacebookLink {
  const raw = unwrapEmbed(input);
  if (!raw) return { kind: 'invalid', message: 'Paste the Facebook Live video link.' };

  let u: URL;
  try {
    // People often paste "facebook.com/..." without the scheme
    u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return { kind: 'invalid', message: 'That doesn\'t look like a link. Paste the Facebook video address.' };
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') {
    return { kind: 'invalid', message: 'Paste a Facebook video link (https://...).' };
  }

  const host = u.hostname.toLowerCase();
  if (host === 'fb.watch' || host === 'www.fb.watch') {
    return { kind: 'needs-resolve', url: `https://fb.watch${u.pathname}` };
  }
  if (!FB_HOST.test(host)) {
    return { kind: 'invalid', message: 'Only Facebook video links are supported (facebook.com or fb.watch).' };
  }

  const parts = u.pathname.split('/').filter(Boolean);
  const v = u.searchParams.get('v');

  // /share/v/<code>, /share/r/<code>, /share/<code>: redirect links
  if (parts[0] === 'share') return { kind: 'needs-resolve', url: `https://www.facebook.com${u.pathname}` };

  // /watch/?v=ID, /watch?v=ID, /watch/live/?v=ID, /video.php?v=ID
  if ((parts[0] === 'watch' || parts[0] === 'video.php') && v && DIGITS.test(v)) {
    return { kind: 'video', videoId: v, canonicalUrl: `https://www.facebook.com/watch/?v=${v}` };
  }

  // /reel/ID (reels are videos with the same id)
  if (parts[0] === 'reel' && parts[1] && DIGITS.test(parts[1])) {
    return { kind: 'video', videoId: parts[1], canonicalUrl: `https://www.facebook.com/watch/?v=${parts[1]}` };
  }

  // /<page>/videos/ID, /<page>/videos/<slug>/ID, /<page>/videos/vb.X/ID: the id is the last number
  const videosAt = parts.indexOf('videos');
  if (videosAt === 1) {
    const id = [...parts.slice(2)].reverse().find((p) => DIGITS.test(p));
    if (id) {
      return { kind: 'video', videoId: id, canonicalUrl: `https://www.facebook.com/${parts[0]}/videos/${id}/` };
    }
  }

  // Older forms the database already accepts but without a video id (a page's /live, story.php):
  // keep them working, normalized to https://www.facebook.com
  const normalized = `https://www.facebook.com${u.pathname}${u.search}`;
  if (FACEBOOK_VIDEO_URL.test(normalized) && parts[0] !== 'watch') {
    return { kind: 'video', videoId: null, canonicalUrl: normalized };
  }

  return {
    kind: 'invalid',
    message: 'Link to the video itself: open it on Facebook first (the address should contain /videos/ or /watch/?v=).',
  };
}

// Returns an error message, or '' when the link can be saved as it is.
// Short links aren't saveable yet: the form resolves them first.
export function validateFacebookUrl(url: string) {
  const parsed = parseFacebookInput(url);
  if (parsed.kind === 'invalid') return parsed.message;
  if (parsed.kind === 'needs-resolve') return 'This is a share link. Click "Check link" to find the video it points to.';
  return '';
}

// Address of Facebook's embedded player. Always embeds the canonical video address (never a share
// link), so rows saved before canonicalization also play.
export function facebookEmbedUrl(url: string) {
  const parsed = parseFacebookInput(url);
  const href = parsed.kind === 'video' ? parsed.canonicalUrl : url.trim();
  return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(href)}&show_text=false&autoplay=false`;
}

// The address to open on Facebook itself ("Watch on Facebook")
export function facebookWatchUrl(url: string) {
  const parsed = parseFacebookInput(url);
  return parsed.kind === 'video' ? parsed.canonicalUrl : url.trim();
}

// Badge colors for stream status
export const streamStatusStyles: Record<StreamStatus, string> = {
  // Readable on the white cards (the old light-red/gold/gray text was made for a dark page)
  live: 'bg-red-600 text-white border-red-700',
  scheduled: 'bg-gold/15 text-amber-800 border-gold/60',
  ended: 'bg-stone-100 text-stone-700 border-stone-300',
};
