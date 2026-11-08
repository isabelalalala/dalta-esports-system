import 'server-only';
import { parseFacebookInput } from '@/utils/streams';
import { embedLooksUnavailable, videoFromHtml, videoFromLocation, type ResolvedVideo } from '@/utils/facebook-resolve-parse';

// Follows a Facebook share link (/share/v/..., /share/r/..., fb.watch/...) to the video it points to.
// SERVER ONLY (used by POST /api/streams/resolve-url).
//
// Safety: only https requests to facebook.com / fb.watch are ever made, so the route can't be used
// to reach other servers (SSRF); at most MAX_HOPS requests, each with a timeout and a size limit.

const MAX_HOPS = 6;
const TIMEOUT_MS = 8000;
const MAX_HTML_BYTES = 600_000;
// A plain, honest client name (no personal data)
const USER_AGENT = 'Mozilla/5.0 (compatible; DALTA-Esports-LinkCheck/1.0)';

function isAllowedHost(url: URL) {
  return url.protocol === 'https:' && /(^|\.)facebook\.com$|^(www\.)?fb\.watch$/i.test(url.hostname);
}

async function readLimited(res: Response) {
  const reader = res.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < MAX_HTML_BYTES) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    chunks.push(value);
    total += value.length;
  }
  await reader.cancel().catch(() => {});
  return new TextDecoder().decode(Buffer.concat(chunks));
}

// Asks Facebook's embed player (as a logged-out visitor, like most viewers) whether the video plays.
// false = Facebook shows "Video Unavailable / no permission" (private, profile video, embedding
// off, restricted); null = couldn't tell (no such message, or the request failed).
export async function checkFacebookEmbed(canonicalUrl: string): Promise<false | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(
      `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(canonicalUrl)}&show_text=false`,
      {
        signal: controller.signal,
        headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en-US,en;q=0.8', Accept: 'text/html' },
        cache: 'no-store',
      },
    );
    if (!res.ok || !isAllowedHost(new URL(res.url))) return null;
    return embedLooksUnavailable(await readLimited(res)) ? false : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function resolveFacebookShareLink(start: string): Promise<ResolvedVideo | null> {
  let current = new URL(start);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    for (let hop = 0; hop < MAX_HOPS; hop++) {
      if (!isAllowedHost(current)) return null;

      const res = await fetch(current, {
        redirect: 'manual',
        signal: controller.signal,
        headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en-US,en;q=0.8', Accept: 'text/html' },
        cache: 'no-store',
      });

      const location = res.headers.get('location');
      if (res.status >= 300 && res.status < 400 && location) {
        const next = new URL(location, current);
        // The redirect itself (or the login wall's ?next=) may already name the video
        const found = videoFromLocation(next.toString());
        if (found) return found;
        current = next;
        continue;
      }

      if (res.ok) {
        // Landed on a page: it may be the video page itself, or carry og:url / canonical
        const direct = parseFacebookInput(current.toString());
        if (direct.kind === 'video' && direct.videoId) {
          return { canonicalUrl: direct.canonicalUrl, videoId: direct.videoId };
        }
        return videoFromHtml(await readLimited(res));
      }
      return null;
    }
    return null;
  } catch {
    // timeout, network error, bad URL
    return null;
  } finally {
    clearTimeout(timer);
  }
}
