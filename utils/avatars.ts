// Profile pictures (202611081400_avatars_and_tour): public `avatars` bucket, one folder per user
// (<user id>/<random>.webp). The browser crops to a square and resizes to 512x512 WebP before
// uploading (components/AvatarUploader.tsx); profiles.avatar_url holds the public address.

export const AVATARS_BUCKET = 'avatars';
// Accepted picture types (the bucket allows the same, plus the resized WebP we upload)
export const AVATAR_INPUT_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
// Size limit of the file we store (also set on the bucket)
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
// Pictures straight from a phone camera are often bigger: we accept them for cropping, because
// what we store is the much smaller 512px WebP
export const AVATAR_MAX_INPUT_BYTES = 10 * 1024 * 1024;
export const AVATAR_OUTPUT_PX = 512;

// "Juan dela Cruz" -> "JC", "Isabella" -> "IS", "" -> "?"
export function initialsOf(name: string | null | undefined): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

// Returns an error message, or '' if the chosen file can be cropped
export function validateAvatarFile(file: { type: string; size: number }): string {
  if (!AVATAR_INPUT_TYPES.includes(file.type)) return 'Choose a JPG, PNG or WebP picture.';
  if (file.size > AVATAR_MAX_INPUT_BYTES) return 'That picture is too large. Choose one under 10 MB.';
  return '';
}

// Square crop in the source image's pixels, from the cropper's zoom (1 = the whole short side)
// and its centre (0..1 of the image). Clamped so the square never leaves the image.
export function cropSquare(
  width: number, height: number, zoom: number, centerX: number, centerY: number,
): { sx: number; sy: number; size: number } {
  const size = Math.min(width, height) / Math.max(zoom, 1);
  const sx = Math.min(Math.max(centerX * width - size / 2, 0), width - size);
  const sy = Math.min(Math.max(centerY * height - size / 2, 0), height - size);
  return { sx, sy, size };
}

// The storage path for a new picture: <user id>/<random>.<ext> (a new name each time, so the
// browser and CDN never show an old cached picture)
export function avatarPath(userId: string, ext: 'webp' | 'png' | 'jpg' = 'webp'): string {
  return `${userId}/${crypto.randomUUID()}.${ext}`;
}

// The storage path inside the bucket, from a public address (to delete the old file)
export function avatarPathFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${AVATARS_BUCKET}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : decodeURIComponent(url.slice(i + marker.length).split('?')[0]);
}
