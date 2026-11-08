import { parseFacebookInput } from '@/utils/streams';

// Pure helpers for utils/facebook-resolve.ts (kept apart so they can be unit tested without the network).

export interface ResolvedVideo {
  canonicalUrl: string;
  videoId: string;
}

function asVideo(url: string): ResolvedVideo | null {
  const parsed = parseFacebookInput(url);
  return parsed.kind === 'video' && parsed.videoId
    ? { canonicalUrl: parsed.canonicalUrl, videoId: parsed.videoId }
    : null;
}

// A redirect target. Facebook often sends servers to its login page with the real address in
// ?next=..., e.g. https://www.facebook.com/login/?next=https%3A%2F%2Fwww.facebook.com%2Fwatch%2F%3Fv%3D123
export function videoFromLocation(location: string): ResolvedVideo | null {
  const direct = asVideo(location);
  if (direct) return direct;
  try {
    const next = new URL(location).searchParams.get('next');
    return next ? asVideo(next) : null;
  } catch {
    return null;
  }
}

// Facebook's embed page (plugins/video.php) for a video that viewers can't play shows
// "Video Unavailable ... you don't have permission to view it" (seen 2026-11-08, English page).
// Returns true when that message is there. false only means "no such message found": we have
// no reliable marker for "this one plays", so callers treat false as "not confirmed broken".
export function embedLooksUnavailable(html: string): boolean {
  const text = html.replace(/&#0?39;|&apos;/g, "'").toLowerCase();
  return text.includes('video unavailable') || text.includes("you don't have permission to view");
}

// A fetched page: og:url, <link rel="canonical">, or a "video_id" in the page data
export function videoFromHtml(html: string): ResolvedVideo | null {
  const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/\\\//g, '/');
  const candidates = [
    html.match(/<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i)?.[1],
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:url["']/i)?.[1],
    html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1],
  ];
  for (const c of candidates) {
    const found = c ? asVideo(decode(c)) : null;
    if (found) return found;
  }
  const id = html.match(/"video_id"\s*:\s*"(\d{5,})"/)?.[1];
  return id ? { canonicalUrl: `https://www.facebook.com/watch/?v=${id}`, videoId: id } : null;
}
