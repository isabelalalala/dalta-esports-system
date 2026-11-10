import {
  Activity, Award, Brain, CalendarClock, CalendarDays, ChartColumn, ChartLine, ClipboardList, Flame, Gamepad2, Globe,
  GraduationCap, HeartHandshake, Home, Info, LayoutDashboard, LifeBuoy, Megaphone, MessageSquare, Network,
  Shield, ShieldAlert, Swords, Trophy, Tv, UserCircle, UserCog, UserPlus, Users, type LucideIcon,
} from 'lucide-react';
import type { NavIcon } from '@/utils/navigation';

// One icon per concept, everywhere (sidebar, bottom bar, More sheet, dashboard shortcuts, avatar
// menu): Dashboard = grid, Home = house, Teams = users, Tournaments = trophy, Live Streams = TV,
// Feedback = message. Two different concepts never share an icon (Teams and Team Management are
// both teams). All Lucide SVGs at the default 2px stroke.
export const NAV_ICONS: Record<NavIcon, LucideIcon> = {
  home: Home, dashboard: LayoutDashboard, events: CalendarDays, tournaments: Trophy, live: Tv, teams: Users,
  feedback: MessageSquare, profile: UserCircle, myteam: Shield, schedule: CalendarClock, recruiting: UserPlus,
  matches: Swords, brackets: Network, users: UserCog, announcements: Megaphone, sentiment: Brain,
  reports: ChartColumn, verification: GraduationCap, website: Globe, activity: Activity, about: Info,
  campaigns: Flame, divisions: Gamepad2, community: HeartHandshake, stats: ChartLine, registrations: ClipboardList,
  moderation: ShieldAlert, help: LifeBuoy, halloffame: Award,
};
