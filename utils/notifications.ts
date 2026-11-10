// In-app notifications (see migration 202610171200_notifications; the latest type list is in
// 202611081500_comments_moderation): row type, icons and the
// read/unread actions shared by the header bell and /notifications.
import type { LucideIcon } from 'lucide-react';
import {
  AlarmClock, Ban, CalendarClock, CalendarDays, CircleCheck, CircleMinus, CircleX, ClipboardList, Crown,
  DoorOpen, FileText, Flag, GraduationCap, Handshake, IdCard, Mail, Megaphone, Radio, Scale, Target,
  ShieldAlert, ShieldCheck, ThumbsUp, Trash, Trophy, TriangleAlert, Undo2, UserCheck, UserCog, UserMinus, UserPlus,
  UserX, Users, ImageOff, Award,
} from 'lucide-react';
import type { createClient } from '@/utils/supabase/client';
import { formatMomentDate } from '@/utils/tournaments';

type SupabaseClient = ReturnType<typeof createClient>;

export type NotificationType =
  | 'registration_approved' | 'registration_rejected' | 'registration_removed'
  | 'registration_submitted' | 'registration_withdrawn'
  | 'match_scheduled' | 'match_rescheduled' | 'match_live'
  | 'checkin_open' | 'match_forfeit'
  | 'result_submitted' | 'result_confirmed' | 'result_disputed' | 'result_approved' | 'result_rejected'
  | 'tournament_cancelled'
  | 'announcement'
  | 'team_invite' | 'invite_accepted' | 'invite_declined' | 'team_captain'
  | 'team_added' | 'member_left' | 'member_removed'
  | 'join_request' | 'join_request_accepted' | 'join_request_declined'
  | 'student_verified' | 'student_rejected' | 'student_revoked'
  | 'verification_submitted' | 'role_changed'
  | 'prediction_result'
  | 'team_removed' | 'team_restored'
  | 'avatar_removed'
  | 'warning_issued' | 'warning_removed' | 'content_restored'
  | 'account_flagged' | 'ban_review' | 'ban_dismissed' | 'account_unbanned'
  | 'team_logo_removed'
  | 'comment_reported'
  | 'hall_of_fame';

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

export const notificationIcons: Record<NotificationType, LucideIcon> = {
  registration_approved: CircleCheck,
  registration_rejected: CircleX,
  registration_removed: Trash,
  registration_submitted: ClipboardList,
  registration_withdrawn: CircleMinus,
  match_scheduled: CalendarDays,
  match_rescheduled: CalendarClock,
  match_live: Radio,
  checkin_open: AlarmClock,
  match_forfeit: Flag,
  result_submitted: FileText,
  result_confirmed: ThumbsUp,
  result_disputed: Scale,
  result_approved: Trophy,
  result_rejected: Undo2,
  tournament_cancelled: Ban,
  announcement: Megaphone,
  team_invite: Mail,
  invite_accepted: Handshake,
  invite_declined: CircleX,
  team_captain: Crown,
  team_added: Users,
  member_left: DoorOpen,
  member_removed: UserMinus,
  join_request: UserPlus,
  join_request_accepted: UserCheck,
  join_request_declined: UserX,
  student_verified: GraduationCap,
  student_rejected: TriangleAlert,
  student_revoked: TriangleAlert,
  verification_submitted: IdCard,
  role_changed: UserCog,
  prediction_result: Target,
  team_removed: Ban,
  team_restored: Undo2,
  avatar_removed: UserX,
  team_logo_removed: ImageOff,
  comment_reported: Flag,
  hall_of_fame: Award,
  warning_issued: TriangleAlert,
  warning_removed: CircleCheck,
  content_restored: Undo2,
  account_flagged: ShieldAlert,
  ban_review: Scale,
  ban_dismissed: ShieldCheck,
  account_unbanned: ShieldCheck,
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
  // Same "Nov 9, 2026" (Philippine date) as every other date in the app
  return formatMomentDate(value);
}

// Notification preferences (/notifications → Settings; table notification_preferences,
// 202611091900). Each group can be turned off; the database skips muted types in notify_users().
// Moderation, account and removal notices are not listed: they can't be turned off (CHECK in the
// migration). `roles`: who gets that kind of notification (the others don't see the switch).
export interface NotificationGroup {
  key: string;
  label: string;
  hint: string;
  types: NotificationType[];
  roles: string[];
}

export const NOTIFICATION_GROUPS: NotificationGroup[] = [
  { key: 'announcements', label: 'Announcements', hint: 'New general and tournament announcements', types: ['announcement'], roles: ['player', 'spectator', 'staff', 'admin'] },
  { key: 'matches', label: 'Match times and live', hint: 'A match is scheduled, moved or goes live; check-in opens; forfeits', types: ['match_scheduled', 'match_rescheduled', 'match_live', 'checkin_open', 'match_forfeit'], roles: ['player'] },
  { key: 'results', label: 'Match results', hint: 'Results submitted, confirmed, disputed, approved or rejected', types: ['result_submitted', 'result_confirmed', 'result_disputed', 'result_approved', 'result_rejected'], roles: ['player', 'staff', 'admin'] },
  { key: 'registrations', label: 'Registrations', hint: 'Your team is approved, rejected or removed; tournament cancelled', types: ['registration_approved', 'registration_rejected', 'registration_removed', 'tournament_cancelled'], roles: ['player'] },
  { key: 'teams', label: 'Team invites and requests', hint: 'Invites, join requests, members leaving, captaincy', types: ['team_invite', 'invite_accepted', 'invite_declined', 'team_captain', 'member_left', 'member_removed', 'join_request', 'join_request_accepted', 'join_request_declined'], roles: ['player'] },
  { key: 'verification', label: 'Student verification', hint: 'Your student details are verified, rejected or revoked', types: ['student_verified', 'student_rejected', 'student_revoked'], roles: ['player'] },
  { key: 'halloffame', label: 'Hall of Fame', hint: 'Your team won a tournament and is in the Hall of Fame', types: ['hall_of_fame'], roles: ['player'] },
  { key: 'predictions', label: "Pick'em results", hint: 'Whether your pick was right', types: ['prediction_result'], roles: ['player', 'spectator'] },
  { key: 'organizer', label: 'Organizer queue', hint: 'New registrations, withdrawals, student details to review, reported comments', types: ['registration_submitted', 'registration_withdrawn', 'verification_submitted', 'comment_reported'], roles: ['staff', 'admin'] },
];
