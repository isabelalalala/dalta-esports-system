'use client';

import { Suspense, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Info,
  Flame,
  CalendarDays,
  Trophy,
  Gamepad2,
  Users,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
  type LucideIcon,
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/about', label: 'About Us', icon: Info },
  { href: '/campaigns', label: 'Campaigns', icon: Flame },
  { href: '/events', label: 'Events', icon: CalendarDays },
  { href: '/tournaments', label: 'Tournaments', icon: Trophy },
  { href: '/divisions', label: 'Game Divisions', icon: Gamepad2 },
  { href: '/community', label: 'Community', icon: Users },
];

export default function SiteNavLayout({ children }: { children: ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Restore collapse preference from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('dalta_site_nav_collapsed');
      if (saved === 'true') {
        setIsCollapsed(true);
      }
    } catch {
      // Ignore storage errors in private/restricted browsing modes
    }
    setMounted(true);
  }, []);

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('dalta_site_nav_collapsed', String(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  };

  return (
    <div className="flex-1 w-full bg-white text-stone-950 uppercase flex flex-col lg:flex-row min-h-[calc(100vh-65px)]">
      {/* ----------------- MOBILE NAVIGATION BAR (< lg) ----------------- */}
      <div className="lg:hidden w-full border-b border-stone-200/90 bg-white sticky top-14 z-30">
        <div className="px-5 py-3 flex items-center justify-between">
          <span className="text-xs font-black tracking-widest text-stone-700 uppercase">
            Menu Navigation
          </span>
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            className="p-1.5 rounded-xl border border-stone-200 bg-stone-50 text-stone-700 hover:text-stone-950 hover:bg-stone-100 transition-colors cursor-pointer"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <nav aria-label="Mobile Navigation" className="border-t border-stone-100 bg-stone-50/70 p-3 space-y-1">
            <Suspense fallback={<MobileNavListFallback onSelect={() => setMobileMenuOpen(false)} />}>
              <MobileNavList onSelect={() => setMobileMenuOpen(false)} />
            </Suspense>
          </nav>
        )}
      </div>

      {/* ----------------- DESKTOP SIDEBAR WITH VERTICAL SEPARATOR LINE (lg+) ----------------- */}
      <aside
        aria-label="Desktop Side Navigation"
        className={`hidden lg:flex flex-col shrink-0 border-r border-stone-200/90 bg-white sticky top-14 h-[calc(100vh-56px)] z-20 ${
          mounted ? 'transition-[width] duration-300 ease-in-out' : ''
        } ${
          isCollapsed ? 'w-20' : 'w-64 xl:w-72'
        }`}
      >
        {/* Top Header Row with Menu Label & Collapse/Expand Button */}
        <div className={`flex items-center border-b border-stone-100 p-4 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          {!isCollapsed && (
            <span className="text-[11px] font-black uppercase tracking-widest text-stone-400">
              Menu
            </span>
          )}
          <button
            type="button"
            onClick={toggleCollapse}
            aria-label={isCollapsed ? 'Expand navigation menu' : 'Collapse navigation menu'}
            title={isCollapsed ? 'Expand menu' : 'Collapse menu'}
            className="p-2 rounded-xl text-stone-500 hover:text-[#5B271E] hover:bg-stone-100 border border-transparent hover:border-stone-200 transition-all cursor-pointer"
          >
            {isCollapsed ? (
              <PanelLeftOpen className="h-5 w-5 text-[#5B271E]" />
            ) : (
              <PanelLeftClose className="h-5 w-5" />
            )}
          </button>
        </div>

        {/* Navigation Items (Wrapped in Suspense to satisfy Next.js prerender rules) */}
        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
          <Suspense fallback={<DesktopNavListFallback isCollapsed={isCollapsed} />}>
            <DesktopNavList isCollapsed={isCollapsed} />
          </Suspense>
        </nav>
      </aside>

      {/* ----------------- ADJUSTABLE MAIN CONTENT SECTION ----------------- */}
      <main
        id="main-content"
        className={`flex-1 min-w-0 w-full px-6 sm:px-8 lg:px-12 xl:px-16 py-8 sm:py-10 ${
          mounted ? 'transition-all duration-300 ease-in-out' : ''
        }`}
      >
        {children}
      </main>
    </div>
  );
}

// Inner component accessing usePathname() safely inside Suspense
function DesktopNavList({ isCollapsed }: { isCollapsed: boolean }) {
  const pathname = usePathname();

  return (
    <>
      {NAV_ITEMS.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href !== '/' && pathname?.startsWith(item.href)) ||
          (item.href === '/dashboard' && pathname?.startsWith('/admin'));

        if (isCollapsed) {
          return (
            <div key={item.href} className="relative group flex justify-center">
              <Link
                href={item.href}
                aria-label={item.label}
                className={`flex items-center justify-center w-11 h-11 rounded-xl transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#5B271E]/10 text-[#5B271E] font-black border border-[#5B271E]/25 shadow-2xs'
                    : 'text-stone-600 hover:text-[#5B271E] hover:bg-[#FFCC37]/15'
                }`}
              >
                <item.icon className={`h-5 w-5 shrink-0 transition-colors ${isActive ? 'text-[#5B271E]' : 'text-stone-600 group-hover:text-[#FFCC37]'}`} />
              </Link>

              {/* Flyout Tooltip when Minimized */}
              <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 hidden group-hover:flex items-center z-50">
                <div className="whitespace-nowrap rounded-xl bg-stone-900 text-white text-[11px] font-black uppercase tracking-widest px-3 py-1.5 shadow-lg border border-stone-800">
                  {item.label}
                </div>
              </div>
            </div>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-xs sm:text-sm font-extrabold uppercase tracking-wider transition-all cursor-pointer group ${
              isActive
                ? 'bg-[#5B271E]/10 text-[#5B271E] font-black border border-[#5B271E]/25 shadow-2xs'
                : 'text-stone-700 hover:text-[#5B271E] hover:bg-[#FFCC37]/15'
            }`}
          >
            <item.icon className={`h-4.5 w-4.5 shrink-0 transition-colors ${isActive ? 'text-[#5B271E]' : 'text-stone-500 group-hover:text-[#FFCC37]'}`} />
            <span className="truncate group-hover:translate-x-0.5 transition-transform">{item.label}</span>
          </Link>
        );
      })}
    </>
  );
}

// Fallback during static prerendering
function DesktopNavListFallback({ isCollapsed }: { isCollapsed: boolean }) {
  return (
    <>
      {NAV_ITEMS.map((item) => {
        if (isCollapsed) {
          return (
            <div key={item.href} className="flex justify-center">
              <Link
                href={item.href}
                aria-label={item.label}
                className="flex items-center justify-center w-11 h-11 rounded-xl text-stone-600 hover:text-stone-950 hover:bg-stone-100/80 transition-all cursor-pointer"
              >
                <item.icon className="h-5 w-5 shrink-0 text-stone-600" />
              </Link>
            </div>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3.5 px-4 py-3 rounded-xl text-xs sm:text-sm font-extrabold uppercase tracking-wider text-stone-700 hover:text-stone-950 hover:bg-stone-100/80 transition-all cursor-pointer"
          >
            <item.icon className="h-4.5 w-4.5 shrink-0 text-stone-500" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </>
  );
}

// Mobile nav list accessing usePathname() inside Suspense
function MobileNavList({ onSelect }: { onSelect: () => void }) {
  const pathname = usePathname();

  return (
    <>
      {NAV_ITEMS.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href !== '/' && pathname?.startsWith(item.href)) ||
          (item.href === '/dashboard' && pathname?.startsWith('/admin'));
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onSelect}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all group ${
              isActive
                ? 'bg-[#5B271E]/10 text-[#5B271E] font-black border border-[#5B271E]/25'
                : 'text-stone-700 hover:bg-[#FFCC37]/15 hover:text-[#5B271E]'
            }`}
          >
            <item.icon className={`h-4 w-4 shrink-0 transition-colors ${isActive ? 'text-[#5B271E]' : 'text-stone-500 group-hover:text-[#FFCC37]'}`} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </>
  );
}

function MobileNavListFallback({ onSelect }: { onSelect: () => void }) {
  return (
    <>
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={onSelect}
          className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-stone-700 hover:bg-white hover:text-amber-800 transition-all"
        >
          <item.icon className="h-4 w-4 shrink-0 text-stone-500" />
          <span>{item.label}</span>
        </Link>
      ))}
    </>
  );
}
