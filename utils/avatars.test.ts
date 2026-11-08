import { describe, expect, it } from 'vitest';
import { avatarPathFromUrl, cropSquare, initialsOf, validateAvatarFile } from '@/utils/avatars';

describe('initialsOf', () => {
  it('takes first and last initials', () => {
    expect(initialsOf('Juan dela Cruz')).toBe('JC');
    expect(initialsOf('Isabella')).toBe('IS');
    expect(initialsOf('  ')).toBe('?');
    expect(initialsOf(null)).toBe('?');
  });
});

describe('validateAvatarFile', () => {
  it('accepts jpg, png and webp under 10 MB', () => {
    expect(validateAvatarFile({ type: 'image/jpeg', size: 3_000_000 })).toBe('');
    expect(validateAvatarFile({ type: 'image/webp', size: 1000 })).toBe('');
  });
  it('refuses other types and huge files', () => {
    expect(validateAvatarFile({ type: 'image/gif', size: 1000 })).toContain('JPG');
    expect(validateAvatarFile({ type: 'image/png', size: 11 * 1024 * 1024 })).toContain('10 MB');
  });
});

describe('cropSquare', () => {
  it('uses the whole short side at zoom 1, centred', () => {
    expect(cropSquare(1000, 500, 1, 0.5, 0.5)).toEqual({ sx: 250, sy: 0, size: 500 });
  });
  it('zooms in and never leaves the image', () => {
    expect(cropSquare(1000, 500, 2, 0.5, 0.5)).toEqual({ sx: 375, sy: 125, size: 250 });
    expect(cropSquare(1000, 500, 2, 0, 0)).toEqual({ sx: 0, sy: 0, size: 250 });
    expect(cropSquare(1000, 500, 2, 1, 1)).toEqual({ sx: 750, sy: 250, size: 250 });
  });
});

describe('avatarPathFromUrl', () => {
  it('extracts the storage path', () => {
    expect(avatarPathFromUrl('https://x.supabase.co/storage/v1/object/public/avatars/u1/a.webp')).toBe('u1/a.webp');
    expect(avatarPathFromUrl('https://elsewhere.com/a.webp')).toBeNull();
    expect(avatarPathFromUrl(null)).toBeNull();
  });
});
