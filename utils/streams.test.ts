import { describe, expect, it } from 'vitest';
import { facebookEmbedUrl, validateFacebookUrl } from '@/utils/streams';

describe('validateFacebookUrl', () => {
  it('accepts facebook.com https links, including mobile/www subdomains', () => {
    expect(validateFacebookUrl('https://www.facebook.com/watch?v=123')).toBe('');
    expect(validateFacebookUrl('https://m.facebook.com/video/1')).toBe('');
    expect(validateFacebookUrl('https://web.facebook.com/watch?v=2')).toBe('');
    expect(validateFacebookUrl('https://facebook.com/groups/x/permalink/1')).toBe('');
  });
  it('rejects empty input', () => {
    expect(validateFacebookUrl('   ')).toContain('Paste');
  });
  it('rejects fb.watch short links with a how-to message', () => {
    expect(validateFacebookUrl('https://fb.watch/abc')).toContain('full link');
  });
  it('rejects http and non-facebook domains', () => {
    expect(validateFacebookUrl('http://facebook.com/watch?v=1')).toContain('https://');
    expect(validateFacebookUrl('https://youtube.com/watch?v=1')).toContain('facebook.com');
    expect(validateFacebookUrl('https://facebook.com.evil.com/x')).toContain('facebook.com');
  });
});

describe('facebookEmbedUrl', () => {
  it('wraps the URL in the embed player, URL-encoded', () => {
    const url = facebookEmbedUrl(' https://www.facebook.com/watch?v=1 ');
    expect(url.startsWith('https://www.facebook.com/plugins/video.php?href=')).toBe(true);
    expect(url).toContain(encodeURIComponent('https://www.facebook.com/watch?v=1'));
  });
});
