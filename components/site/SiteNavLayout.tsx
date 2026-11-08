'use client';

import { Suspense, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Activity, Brain, CalendarDays, ChartColumn, ChevronLeft, ChevronRight, ClipboardList, Flame, Gamepad2,
  Globe, GraduationCap, Home, Info, LayoutDashboard, Megaphone, Menu, MessageSquare, MoreHorizontal,
  PanelLeftClose, PanelLeftOpen, Shield, ShieldAlert, Swords, Trophy, Tv, UserCircle, UserPlus, Users, Network, X,
  type LucideIcon,
} from 'lucide-react';
import Tooltip from '@/components/Tooltip';
import FlaggedAccountNotice from '@/components/FlaggedAccountNotice';
import { useViewer } from '@/utils/use-viewer';
import { useBreadcrumbNames } from '@/utils/breadcrumb-names';
import {
  activeItem, breadcrumbsFor, isInnerPage, navFor, type NavGroup, type NavIcon, type NavItem,
} from '@/utils/navigation';

const ICONS: Record<NavIcon, LucideIcon> = {
  home: Home, dashboard: LayoutDashboard, events: CalendarDays, tournaments: Trophy, live: Tv, teams: Users,
  feedback: MessageSquare, profile: UserCircle, myteam: Shield, schedule: CalendarDays, recruiting: UserPlus,
  matches: Swords, brackets: Network, users: Users, announcements: Megaphone, sentiment: Brain,
  reports: ChartColumn, verification: GraduationCap, website: Globe, activity: Activity, about: Info,
  campaigns: Flame, divisions: Gamepad2, community: Users, stats: ChartColumn, registrations: ClipboardList,
  moderation: ShieldAlert,
};

// The "collapse menu" choice, saved in localStorage (kept in memory when storage is blocked,
// e.g. private browsing). Read through useSyncExternalStore so the server and browser agree.
const COLLAPSE_KEY = 'dalta_site_nav_collapsed';
const collapseListeners = new Set<() => void>();
let collapsedInMemory = false;

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === 'true';
  } catch {
    return collapsedInMemory;
  }
}

function writeCollapsed(value: boolean) {
  collapsedInMemory = value;
  try {
    localStorage.setItem(COLLAPSE_KEY, String(value));
  } catch {
    // Storage blocked: the in-memory value is used instead
  }
  collapseListeners.forEach((notify) => notify());
}

function subscribeCollapsed(notify: () => void) {
  collapseListeners.add(notify);
  return () => {
    collapseListeners.delete(notify);
  };
}

const subscribeNothing = () => () => {};

// The app's one navigation, for public and logged-in pages (docs/brand.md):
// - large screens: collapsible sidebar with the role's menu (utils/navigation.ts)
// - phones, logged in: bottom tab bar (4 items + More); phones, logged out: Menu bar under the header
// - inner pages: breadcrumbs + back button above the page
// It renders the page's <main id="main-content">, so pages inside it start with a <div>.
export default function SiteNavLayout({ children }: { children: ReactNode }) {
  const isCollapsed = useSyncExternalStore(subscribeCollapsed, readCollapsed, () => false);
  // false on the server and the first render, true after: no width animation on page load
  const mounted = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const viewer = useViewer();
  const loggedIn = !!viewer.userId;
  const nav = navFor(viewer.role, loggedIn);
  const ready = viewer.status === 'ready';
  const pathname = usePathname();

  return (
    <div className="flex-1 w-full bg-white text-stone-950 flex flex-col lg:flex-row min-h-[calc(100vh-var(--site-header-h))]">
      {/* Phones, logged out: Menu bar with the full list */}
      {ready && !loggedIn && <MobileMenuBar groups={nav.groups} />}

      {/* Large screens: sidebar */}
      <aside
        aria-label="Main navigation"
        className={`hidden lg:flex flex-col shrink-0 border-r border-stone-200/90 bg-white sticky top-(--site-header-h) h-[calc(100vh-var(--site-header-h))] z-20 ${
          mounted ? 'transition-[width] duration-300 ease-in-out' : ''
        } ${isCollapsed ? 'w-20' : 'w-64 xl:w-72'}`}
      >
        <div className={`flex items-center border-b border-stone-100 p-4 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          {!isCollapsed && (
            <span className="text-[11px] font-black uppercase tracking-widest text-stone-600">Menu</span>
          )}
          <Tooltip text={isCollapsed ? 'Show the menu labels' : 'Make the menu narrow'} side="right">
            <button
              type="button"
              onClick={() => writeCollapsed(!isCollapsed)}
              aria-label={isCollapsed ? 'Expand navigation menu' : 'Collapse navigation menu'}
              aria-expanded={!isCollapsed}
              className="p-2 rounded-xl text-stone-600 hover:text-maroon hover:bg-stone-100 transition-colors cursor-pointer"
            >
              {isCollapsed ? <PanelLeftOpen className="h-5 w-5 text-maroon" /> : <PanelLeftClose className="h-5 w-5" />}
            </button>
          </Tooltip>
        </div>

        <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
          {ready ? (
            <Suspense fallback={<NavSkeleton collapsed={isCollapsed} />}>
              <SidebarGroups groups={nav.groups} collapsed={isCollapsed} />
            </Suspense>
          ) : (
            <NavSkeleton collapsed={isCollapsed} />
          )}
        </nav>
      </aside>

      {/* Page. Keyed by path: each new page fades in (off with reduced motion). Bottom padding
          keeps content clear of the phone tab bar. */}
      <main
        id="main-content"
        key={pathname}
        className={`animate-page-enter flex-1 min-w-0 w-full px-4 sm:px-8 lg:px-12 xl:px-16 py-6 sm:py-10 ${
          loggedIn ? 'pb-28 lg:pb-10' : ''
        }`}
      >
        <Suspense fallback={null}>
          <Breadcrumbs />
        </Suspense>
        {/* Accounts flagged at 5 warnings: a notice on the next page load */}
        <FlaggedAccountNotice />
        {children}
      </main>

      {/* Phones, logged in: bottom tab bar */}
      {ready && loggedIn && nav.bottom.length > 0 && (
        <Suspense fallback={null}>
          <BottomBar items={nav.bottom} groups={nav.groups} />
        </Suspense>
      )}
    </div>
  );
}

function useActive(groups: NavGroup[]) {
  const pathname = usePathname() ?? '/';
  const search = useSearchParams();
  return activeItem(pathname, new URLSearchParams(search?.toString() ?? ''), groups.flatMap((g) => g.items));
}

function SidebarGroups({ groups, collapsed }: { groups: NavGroup[]; collapsed: boolean }) {
  const active = useActive(groups);

  return (
    <>
      {groups.map((group, gi) => (
        <div key={gi} className="space-y-1">
          {group.label && !collapsed && (
            <p className="px-4 pt-1 pb-1 text-[11px] font-black uppercase tracking-widest text-stone-600">{group.label}</p>
          )}
          {group.label && collapsed && <hr className="mx-3 border-stone-200" />}
          {group.items.map((item) => {
            const isActive = active?.href === item.href;
            const Icon = ICONS[item.icon];
            const linkClass = isActive
              ? 'bg-maroon/10 text-maroon border-maroon/25 shadow-2xs'
              : 'text-stone-700 border-transparent hover:text-maroon hover:bg-gold/15';
            return (
              <Tooltip
                key={item.href}
                text={collapsed ? `${item.label}: ${item.hint}` : item.hint}
                side="right"
                className={collapsed ? 'flex justify-center w-full' : 'flex w-full'}
              >
                <Link
                  href={item.href}
                  aria-label={collapsed ? item.label : undefined}
                  aria-current={isActive ? 'page' : undefined}
                  className={`group flex items-center rounded-xl border font-extrabold uppercase tracking-wider transition-all ${linkClass} ${
                    collapsed ? 'justify-center w-11 h-11' : 'w-full gap-3.5 px-4 py-2.5 text-xs sm:text-sm'
                  }`}
                >
                  <Icon className={`h-[18px] w-[18px] shrink-0 ${isActive ? 'text-maroon' : 'text-stone-500 group-hover:text-maroon'}`} />
                  {!collapsed && <span className="truncate group-hover:translate-x-0.5 transition-transform">{item.label}</span>}
                </Link>
              </Tooltip>
            );
          })}
        </div>
      ))}
    </>
  );
}

function NavSkeleton({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className={`h-10 rounded-xl bg-stone-100 shimmer-light ${collapsed ? 'w-11 mx-auto' : 'w-full'}`} />
      ))}
    </div>
  );
}

// Phones, logged out: the full menu behind a "Menu" button
function MobileMenuBar({ groups }: { groups: NavGroup[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  return (
    <div className="lg:hidden w-full border-b border-stone-200/90 bg-white sticky top-(--site-header-h) z-30">
      <div className="px-4 py-2.5 flex items-center justify-between">
        <span className="text-xs font-black tracking-widest text-stone-700 uppercase">Menu</span>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={open}
          className="p-2 rounded-xl border border-stone-200 bg-stone-50 text-stone-700 hover:text-stone-950 cursor-pointer"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open && (
        <nav aria-label="Main navigation" className="border-t border-stone-100 bg-stone-50 p-3 max-h-[70vh] overflow-y-auto">
          <Suspense fallback={null}>
            <MenuList groups={groups} />
          </Suspense>
        </nav>
      )}
    </div>
  );
}

// The full menu as a list (phone menu bar and the bottom bar's "More" sheet)
function MenuList({ groups, onSelect }: { groups: NavGroup[]; onSelect?: () => void }) {
  const active = useActive(groups);
  return (
    <div className="space-y-3">
      {groups.map((group, gi) => (
        <div key={gi} className="space-y-1">
          {group.label && <p className="px-3 text-[11px] font-black uppercase tracking-widest text-stone-600">{group.label}</p>}
          {group.items.map((item) => {
            const Icon = ICONS[item.icon];
            const isActive = active?.href === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onSelect}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-black uppercase tracking-wider ${
                  isActive ? 'bg-maroon/10 text-maroon' : 'text-stone-800 hover:bg-gold/15 hover:text-maroon'
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="min-w-0">
                  <span className="block">{item.label}</span>
                  <span className="block text-xs font-medium normal-case tracking-normal text-stone-600">{item.hint}</span>
                </span>
              </Link>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// Phones, logged in: 4 main items + "More" (the full menu in a sheet)
function BottomBar({ items, groups }: { items: NavItem[]; groups: NavGroup[] }) {
  const active = useActive(groups);
  const [moreOpen, setMoreOpen] = useState(false);
  const pathname = usePathname();
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setMoreOpen(false);
  }
  const activeInBar = items.some((i) => i.href === active?.href);

  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [moreOpen]);

  const tabClass = (on: boolean) =>
    `flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-black uppercase tracking-wide ${
      on ? 'text-maroon' : 'text-stone-600'
    }`;

  return (
    <>
      {moreOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-stone-950/50" onClick={() => setMoreOpen(false)} aria-hidden="true" />
      )}
      {moreOpen && (
        <nav
          aria-label="All pages"
          className="lg:hidden fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-50 max-h-[70vh] overflow-y-auto rounded-t-2xl border-t border-stone-200 bg-white p-4 shadow-xl"
        >
          <MenuList groups={groups} onSelect={() => setMoreOpen(false)} />
        </nav>
      )}
      <nav
        aria-label="Quick navigation"
        className="lg:hidden fixed inset-x-0 bottom-0 z-50 border-t border-stone-200 bg-white/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] print:hidden"
      >
        <div className="flex h-16">
          {items.map((item) => {
            const Icon = ICONS[item.icon];
            const on = active?.href === item.href;
            return (
              <Link key={item.href} href={item.href} aria-current={on ? 'page' : undefined} className={tabClass(on)}>
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span className="truncate max-w-full px-1">{item.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen((o) => !o)}
            aria-expanded={moreOpen}
            className={tabClass(moreOpen || (!!active && !activeInBar))}
          >
            {moreOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <MoreHorizontal className="h-5 w-5" aria-hidden="true" />}
            <span>More</span>
          </button>
        </div>
      </nav>
    </>
  );
}

// Inner pages: "← Back" + Home > Section > Page
function Breadcrumbs() {
  const pathname = usePathname() ?? '/';
  const router = useRouter();
  const names = useBreadcrumbNames();
  if (!isInnerPage(pathname)) return null;

  const crumbs = breadcrumbsFor(pathname, names);
  const parent = [...crumbs.slice(0, -1)].reverse().find((c) => c.href);

  const goBack = () => {
    // Back in history when the visitor came from inside the site; otherwise up one level
    const fromHere = typeof document !== 'undefined' && document.referrer.startsWith(window.location.origin);
    if (fromHere && window.history.length > 1) router.back();
    else router.push(parent?.href ?? '/');
  };

  return (
    <div className="mb-4 sm:mb-6 flex items-center gap-2 min-w-0">
      <Tooltip text={`Back to ${parent?.label ?? 'the previous page'}`} side="bottom">
        <button
          type="button"
          onClick={goBack}
          aria-label="Go back"
          className="shrink-0 inline-flex items-center gap-1 rounded-xl border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-black uppercase tracking-wider text-stone-700 hover:text-maroon hover:border-stone-300 cursor-pointer"
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
      </Tooltip>
      <nav aria-label="Breadcrumb" className="min-w-0 overflow-x-auto">
        <ol className="flex items-center gap-1 text-sm text-stone-600 whitespace-nowrap">
          {crumbs.map((c, i) => {
            const last = i === crumbs.length - 1;
            return (
              <li key={`${c.label}-${i}`} className="flex items-center gap-1 min-w-0">
                {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-stone-500" aria-hidden="true" />}
                {last ? (
                  <span aria-current="page" className="font-bold text-stone-950 truncate max-w-[14rem]">{c.label}</span>
                ) : c.href ? (
                  <Link href={c.href} className="hover:text-maroon hover:underline truncate max-w-[10rem]">{c.label}</Link>
                ) : (
                  <span className="truncate max-w-[10rem]">{c.label}</span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}
