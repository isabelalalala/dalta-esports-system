import type { StreamStatus } from '@/utils/types';

// Facebook Live helpers. Videos are played with Facebook's embedded video player,
// which needs no API key but only works for videos set to Public.

// Same rule as the CHECK constraint on streams.facebook_url
const FACEBOOK_URL = /^https:\/\/(www\.|m\.|web\.)?facebook\.com\/.+/i;

// Returns an error message, or '' if the link can be used.
export function validateFacebookUrl(url: string) {
  const value = url.trim();
  if (!value) return 'Paste the Facebook Live video link.';
  if (/^https?:\/\/(www\.)?fb\.watch\//i.test(value)) {
    return 'Short fb.watch links can\'t be embedded. Open the video on Facebook and copy the full link from the address bar.';
  }
  if (!value.startsWith('https://')) return 'The link must start with https://';
  if (!FACEBOOK_URL.test(value)) return 'Only facebook.com video links are supported.';
  return '';
}

// Address of Facebook's embedded player for a video link
export function facebookEmbedUrl(url: string) {
  return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url.trim())}&show_text=false&autoplay=false`;
}

// Badge colors for stream status
export const streamStatusStyles: Record<StreamStatus, string> = {
  live: 'bg-red-500/15 text-red-300 border-red-500/50',
  scheduled: 'bg-gold/15 text-gold border-gold/50',
  ended: 'bg-gray-500/15 text-gray-400 border-gray-500/50',
};
