import {
  CalendarDays, ClipboardList, Medal, Megaphone, Swords, TriangleAlert, Trophy, Tv, type LucideIcon,
} from 'lucide-react';
import { CATEGORY_INFO, categoryOf, type AnnouncementCategory } from '@/utils/announcements';

export const CATEGORY_ICONS: Record<AnnouncementCategory, LucideIcon> = {
  tournament: Trophy,
  match_update: Swords,
  results: Medal,
  event: CalendarDays,
  registration: ClipboardList,
  stream: Tv,
  general: Megaphone,
  urgent: TriangleAlert,
};

// Colored category badge with its icon (one color per category, see CATEGORY_INFO)
export default function CategoryBadge({ category, className = '' }: { category: string; className?: string }) {
  const id = categoryOf(category);
  const Icon = CATEGORY_ICONS[id];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-widest shadow-xs ${CATEGORY_INFO[id].badge} ${className}`}
    >
      <Icon className="size-3" aria-hidden="true" />
      {CATEGORY_INFO[id].label}
    </span>
  );
}
