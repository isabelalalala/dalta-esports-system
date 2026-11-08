import { describe, expect, it } from 'vitest';
import { embedLooksUnavailable, videoFromHtml, videoFromLocation } from '@/utils/facebook-resolve-parse';

describe('embedLooksUnavailable', () => {
  it('spots the message Facebook shows for a video viewers cannot play (captured 2026-11-08)', () => {
    const html = '<div class="_3i0o _50f7">Video Unavailable</div><div class="_3i0p">This video may no longer ' +
      'exist, or you don&#039;t have permission to view it.</div>';
    expect(embedLooksUnavailable(html)).toBe(true);
  });
  it('is false when there is no such message', () => {
    expect(embedLooksUnavailable('<div id="player"></div>')).toBe(false);
  });
});

describe('videoFromLocation', () => {
  it('reads a redirect straight to the video', () => {
    expect(videoFromLocation('https://www.facebook.com/DALTAEsports/videos/1234567890123/')).toEqual({
      canonicalUrl: 'https://www.facebook.com/DALTAEsports/videos/1234567890123/', videoId: '1234567890123',
    });
  });
  it('reads the real redirect Facebook sent for a /share/v/ link (captured 2026-11-08)', () => {
    const location = 'https://www.facebook.com/cogdasma/videos/1995308854497374/?rdid=lfAcfXzdMkp5MuN7' +
      '&share_url=https%3A%2F%2Fwww.facebook.com%2Fshare%2Fv%2F19gcRvkyad%2F';
    expect(videoFromLocation(location)).toEqual({
      canonicalUrl: 'https://www.facebook.com/cogdasma/videos/1995308854497374/', videoId: '1995308854497374',
    });
  });
  it('reads the video out of a login wall ?next=', () => {
    const next = encodeURIComponent('https://www.facebook.com/watch/?v=123456789');
    expect(videoFromLocation(`https://www.facebook.com/login/?next=${next}`)).toEqual({
      canonicalUrl: 'https://www.facebook.com/watch/?v=123456789', videoId: '123456789',
    });
  });
  it('returns null for redirects that are not videos yet', () => {
    expect(videoFromLocation('https://www.facebook.com/share/v/abc/?x=1')).toBeNull();
    expect(videoFromLocation('https://www.facebook.com/login/')).toBeNull();
  });
});

describe('videoFromHtml', () => {
  it('uses og:url in either attribute order', () => {
    expect(videoFromHtml('<meta property="og:url" content="https://www.facebook.com/x/videos/123456789/" />')?.videoId)
      .toBe('123456789');
    expect(videoFromHtml('<meta content="https://www.facebook.com/watch/?v=987654321&amp;ref=1" property="og:url">')?.videoId)
      .toBe('987654321');
  });
  it('falls back to the canonical link, then to video_id in page data', () => {
    expect(videoFromHtml('<link rel="canonical" href="https://www.facebook.com/reel/5555555555" />')?.videoId)
      .toBe('5555555555');
    expect(videoFromHtml('{"video_id":"4444444444","foo":1}')).toEqual({
      canonicalUrl: 'https://www.facebook.com/watch/?v=4444444444', videoId: '4444444444',
    });
  });
  it('returns null for a login page without any video', () => {
    expect(videoFromHtml('<html><title>Log in to Facebook</title></html>')).toBeNull();
  });
});
