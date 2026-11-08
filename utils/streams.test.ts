import { describe, expect, it } from 'vitest';
import { facebookEmbedUrl, facebookWatchUrl, parseFacebookInput, validateFacebookUrl } from '@/utils/streams';

const video = (canonicalUrl: string, videoId: string | null) => ({ kind: 'video', canonicalUrl, videoId });

describe('parseFacebookInput', () => {
  it('canonicalizes /watch links (also /watch/live and old video.php)', () => {
    expect(parseFacebookInput('https://www.facebook.com/watch/?v=123456789')).toEqual(
      video('https://www.facebook.com/watch/?v=123456789', '123456789'));
    expect(parseFacebookInput('https://web.facebook.com/watch?v=123456789&ref=share')).toEqual(
      video('https://www.facebook.com/watch/?v=123456789', '123456789'));
    expect(parseFacebookInput('https://m.facebook.com/watch/live/?v=987654321')).toEqual(
      video('https://www.facebook.com/watch/?v=987654321', '987654321'));
    expect(parseFacebookInput('https://www.facebook.com/video.php?v=555555555')).toEqual(
      video('https://www.facebook.com/watch/?v=555555555', '555555555'));
  });

  it('canonicalizes page video links, keeping the page name', () => {
    expect(parseFacebookInput('https://www.facebook.com/DALTAEsports/videos/1234567890123/')).toEqual(
      video('https://www.facebook.com/DALTAEsports/videos/1234567890123/', '1234567890123'));
    expect(parseFacebookInput('https://m.facebook.com/DALTAEsports/videos/grand-finals/1234567890123/?mibextid=x')).toEqual(
      video('https://www.facebook.com/DALTAEsports/videos/1234567890123/', '1234567890123'));
    expect(parseFacebookInput('facebook.com/DALTAEsports/videos/vb.111/1234567890123')).toEqual(
      video('https://www.facebook.com/DALTAEsports/videos/1234567890123/', '1234567890123'));
  });

  it('turns reels into watch links', () => {
    expect(parseFacebookInput('https://www.facebook.com/reel/7777777777')).toEqual(
      video('https://www.facebook.com/watch/?v=7777777777', '7777777777'));
  });

  it('extracts the video from embed code and plugin URLs', () => {
    const href = encodeURIComponent('https://www.facebook.com/DALTAEsports/videos/1234567890123/');
    const iframe = `<iframe src="https://www.facebook.com/plugins/video.php?height=314&amp;href=${href}&amp;show_text=false" width="560"></iframe>`;
    expect(parseFacebookInput(iframe)).toEqual(
      video('https://www.facebook.com/DALTAEsports/videos/1234567890123/', '1234567890123'));
    expect(parseFacebookInput(`https://www.facebook.com/plugins/video.php?href=${href}`)).toEqual(
      video('https://www.facebook.com/DALTAEsports/videos/1234567890123/', '1234567890123'));
  });

  it('sends share and fb.watch links to the server to resolve', () => {
    expect(parseFacebookInput('https://www.facebook.com/share/v/19gcRvkyad/')).toEqual(
      { kind: 'needs-resolve', url: 'https://www.facebook.com/share/v/19gcRvkyad/' });
    expect(parseFacebookInput('https://m.facebook.com/share/r/abcDEF/')).toEqual(
      { kind: 'needs-resolve', url: 'https://www.facebook.com/share/r/abcDEF/' });
    expect(parseFacebookInput('https://fb.watch/xYz123/')).toEqual(
      { kind: 'needs-resolve', url: 'https://fb.watch/xYz123/' });
  });

  it('keeps the older id-less forms the database accepts (page /live, story.php)', () => {
    expect(parseFacebookInput('https://www.facebook.com/somepage/live')).toEqual(
      video('https://www.facebook.com/somepage/live', null));
    expect(parseFacebookInput('https://www.facebook.com/story.php?story_fbid=1&id=2')).toEqual(
      video('https://www.facebook.com/story.php?story_fbid=1&id=2', null));
  });

  it('rejects links that are not videos, other sites and look-alike domains', () => {
    for (const bad of [
      'https://www.facebook.com/somepage',
      'https://facebook.com/groups/x/permalink/1',
      'https://www.facebook.com/events/123',
      'https://facebook.com/profile.php?id=1',
      'https://www.facebook.com/watch',
      'https://youtube.com/watch?v=1',
      'https://facebook.com.evil.com/watch?v=123456',
      'javascript:alert(1)',
      '',
    ]) {
      expect(parseFacebookInput(bad).kind, bad).toBe('invalid');
    }
  });
});

describe('validateFacebookUrl', () => {
  it('is empty for embeddable links and explains the rest', () => {
    expect(validateFacebookUrl('https://www.facebook.com/watch/?v=123456789')).toBe('');
    expect(validateFacebookUrl('https://www.facebook.com/share/v/19gcRvkyad/')).toContain('Check link');
    expect(validateFacebookUrl('   ')).toContain('Paste');
  });
});

describe('facebookEmbedUrl / facebookWatchUrl', () => {
  it('always embeds the canonical address, never the pasted form', () => {
    const url = facebookEmbedUrl(' https://m.facebook.com/watch?v=123456789&ref=x ');
    expect(url.startsWith('https://www.facebook.com/plugins/video.php?href=')).toBe(true);
    expect(url).toContain(encodeURIComponent('https://www.facebook.com/watch/?v=123456789'));
    expect(url).toContain('show_text=false');
  });
  it('opens the canonical address on Facebook', () => {
    expect(facebookWatchUrl('https://m.facebook.com/reel/7777777777')).toBe('https://www.facebook.com/watch/?v=7777777777');
  });
});
