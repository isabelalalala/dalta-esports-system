// In-app notifications (see migration 202610171200_notifications): row type, icons and the
// read/unread actions shared by the header bell and /notifications.
import type { createClient } from '@/utils/supabase/client';

type SupabaseClient = ReturnType<typeof createClient>;

export type NotificationType =
  | 'registration_approved' | 'registration_rejected'
  | 'match_scheduled' | 'match_rescheduled' | 'match_live'
  | 'checkin_open' | 'match_forfeit'
  | 'result_submitted' | 'result_confirmed' | 'result_disputed' | 'result_approved' | 'result_rejected'
  | 'announcement'
  | 'team_invite' | 'invite_accepted' | 'invite_declined' | 'team_captain'
  | 'team_added' | 'member_left' | 'member_removed'
  | 'student_verified' | 'student_rejected' | 'student_revoked';

export interface AppNotification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  // A page inside the app, or null
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export const notificationIcons: Record<NotificationType, string> = {
  registration_approved: '✅',
  registration_rejected: '❌',
  match_scheduled: '📅',
  match_rescheduled: '🔁',
  match_live: '🔴',
  checkin_open: '⏰',
  match_forfeit: '🏳️',
  result_submitted: '📝',
  result_confirmed: '👍',
  result_disputed: '⚖️',
  result_approved: '🏆',
  result_rejected: '↩️',
  announcement: '📢',
  team_invite: '✉️',
  invite_accepted: '🤝',
  invite_declined: '🚫',
  team_captain: '👑',
  team_added: '👥',
  member_left: '🚪',
  member_removed: '🚪',
  student_verified: '🎓',
  student_rejected: '⚠️',
  student_revoked: '⚠️',
};

export async function fetchUnreadCount(supabase: SupabaseClient) {
  // head: true = only the count, no rows
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('is_read', false);
  if (error) throw error;
  return count ?? 0;
}

// RLS only returns the user's own notifications, so no user filter is needed
export async function fetchNotifications(
  supabase: SupabaseClient,
  { offset = 0, limit = 10, unreadOnly = false } = {}
) {
  let query = supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (unreadOnly) query = query.eq('is_read', false);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as AppNotification[];
}

export async function markAsRead(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  if (error) throw error;
}

export async function markAllAsRead(supabase: SupabaseClient) {
  const { error } = await supabase.from('notifications').update({ is_read: true }).eq('is_read', false);
  if (error) throw error;
}

// "just now", "5 min ago", "3 h ago", "2 d ago", then the date
export function timeAgo(value: string) {
  const seconds = Math.floor((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
  if (seconds < 7 * 86400) return `${Math.floor(seconds / 86400)} d ago`;
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
