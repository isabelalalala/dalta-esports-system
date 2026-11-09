// Loading the extras of announcements (reactions, read state, linked cards). Works with any
// Supabase client (browser or server); RLS and the security definer functions decide what comes back.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/utils/database.types';
import type { AnnouncementLink, FeedAnnouncement, ReactionCounts, ReactionKind } from '@/utils/announcements';

type Client = SupabaseClient<Database>;

// Newest first, pinned on top; drafts/scheduled ones only come back for organizers (RLS)
export async function loadAnnouncements(supabase: Client, limit = 200) {
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .order('pinned', { ascending: false })
    .order('publish_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as FeedAnnouncement[];
}

export async function loadReactions(supabase: Client, ids: string[]): Promise<Record<string, ReactionCounts>> {
  if (ids.length === 0) return {};
  const { data, error } = await supabase.rpc('get_announcement_reactions', { p_ids: ids.slice(0, 100) });
  // Before the migration has run (or on a network error) the cards just show 0
  if (error || !data) return {};
  return Object.fromEntries(
    data.map((r) => [r.announcement_id, { hype: r.hype, gg: r.gg, heart: r.heart, mine: (r.mine ?? []) as ReactionKind[] }]),
  );
}

export async function loadLinks(supabase: Client, ids: string[]): Promise<Record<string, AnnouncementLink>> {
  if (ids.length === 0) return {};
  const { data, error } = await supabase.rpc('get_announcement_links', { p_ids: ids.slice(0, 100) });
  if (error || !data) return {};
  return Object.fromEntries(
    data.filter((r) => r.link).map((r) => [r.announcement_id, r.link as unknown as AnnouncementLink]),
  );
}

// The logged-in user's read announcements among `ids` (RLS: own rows only)
export async function loadReadIds(supabase: Client, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const { data, error } = await supabase
    .from('announcement_reads').select('announcement_id').in('announcement_id', ids.slice(0, 200));
  if (error || !data) return new Set();
  return new Set(data.map((r) => r.announcement_id));
}

// Marks announcements as read (already-read ones are left alone). Failures are ignored: the NEW
// badge is only a hint.
export async function markRead(supabase: Client, ids: string[]) {
  if (ids.length === 0) return;
  await supabase
    .from('announcement_reads')
    .upsert(ids.map((announcement_id) => ({ announcement_id })), { onConflict: 'user_id,announcement_id', ignoreDuplicates: true });
}
