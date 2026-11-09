import { Ban, CheckCircle2, Clock, Crown, Star, UserPlus, Users, XCircle, type LucideIcon } from 'lucide-react';

// One badge style for team cards and registration cards (meaning colors only: green = good,
// yellow = waiting, red = refused, gray = closed/inactive).
export type BadgeKind =
  | 'recruiting' | 'full' | 'yours'
  | 'pending' | 'approved' | 'rejected' | 'withdrawn'
  | 'captain' | 'member';

const BADGES: Record<BadgeKind, { label: string; icon: LucideIcon; className: string }> = {
  recruiting: { label: 'Recruiting', icon: UserPlus, className: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  full: { label: 'Full', icon: Users, className: 'border-stone-300 bg-stone-100 text-stone-700' },
  yours: { label: 'Your team', icon: Star, className: 'border-gold/60 bg-gold/15 text-maroon' },
  pending: { label: 'Pending', icon: Clock, className: 'border-yellow-200 bg-yellow-50 text-yellow-800' },
  approved: { label: 'Approved', icon: CheckCircle2, className: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  rejected: { label: 'Rejected', icon: XCircle, className: 'border-red-200 bg-red-50 text-red-800' },
  withdrawn: { label: 'Withdrawn', icon: Ban, className: 'border-stone-300 bg-stone-100 text-stone-700' },
  captain: { label: 'Captain', icon: Crown, className: 'border-gold/60 bg-gold/15 text-maroon' },
  member: { label: 'Member', icon: Users, className: 'border-stone-300 bg-stone-100 text-stone-700' },
};

export default function StatusBadge({ kind, label }: { kind: BadgeKind; label?: string }) {
  const { label: defaultLabel, icon: Icon, className } = BADGES[kind];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${className}`}>
      <Icon className="size-3" aria-hidden="true" />
      {label ?? defaultLabel}
    </span>
  );
}
