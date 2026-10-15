// Uploading and deleting website images (admin only; the storage policies check the role).
import type { createClient } from '@/utils/supabase/client';
import { SITE_IMAGES_BUCKET } from '@/utils/site';

type SupabaseClient = ReturnType<typeof createClient>;

const MAX_BYTES = 5 * 1024 * 1024;
// Same list as the bucket's allowed types
const TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

// Returns an error message, or '' if the file can be uploaded
export function checkSiteImage(file: File) {
  if (!TYPES[file.type]) return 'Use a PNG, JPG, WebP or GIF image.';
  if (file.size > MAX_BYTES) return 'The image must be 5 MB or smaller.';
  return '';
}

// Uploads to "<folder>/<random>.<ext>" and returns the path to save in the table
export async function uploadSiteImage(supabase: SupabaseClient, file: File, folder: string) {
  const problem = checkSiteImage(file);
  if (problem) throw new Error(problem);
  const path = `${folder}/${crypto.randomUUID()}.${TYPES[file.type]}`;
  const { error } = await supabase.storage
    .from(SITE_IMAGES_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return path;
}

// Removes a file that is no longer used. Failures are ignored: a leftover file
// doesn't break anything, and the save itself already worked.
export async function deleteSiteImage(supabase: SupabaseClient, path: string | null | undefined) {
  if (!path) return;
  await supabase.storage.from(SITE_IMAGES_BUCKET).remove([path]);
}
