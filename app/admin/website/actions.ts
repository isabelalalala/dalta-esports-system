'use server';

import { updateTag } from 'next/cache';
import { createClient } from '@/utils/supabase/server';

// Called by /admin/website after every save: the public pages (cached with the 'site' tag,
// see utils/site-data.ts) show the change on the next visit instead of up to a minute later.
// Only admins may trigger it; the content itself is protected by RLS anyway.
export async function refreshSite() {
  const supabase = await createClient();
  const { data: role } = await supabase.rpc('get_my_role');
  if (role !== 'admin') return { ok: false };

  updateTag('site');
  return { ok: true };
}
