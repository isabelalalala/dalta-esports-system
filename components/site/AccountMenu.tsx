'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, ChevronDown, LayoutDashboard, LogOut, UserCircle } from 'lucide-react';
import Avatar from '@/components/Avatar';
import RoleBadge from '@/components/RoleBadge';
import { useLogout } from '@/components/useLogout';

// The header's avatar button and its menu: who you are (name + role badge), Dashboard, My Profile,
// Notifications and a labelled Log out. Log out used to be a bare icon right next to the avatar,
// easy to tap by accident on a phone; useLogout() also asks for confirmation on touch layouts.
export default function AccountMenu({
  fullName, avatarUrl, role,
}: {
  fullName: string | null;
  avatarUrl: string | null;
  role: string | null;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [logoutDialog, logout] = useLogout();

  // Close on Esc and on a press outside (a document listener, like NotificationBell: the header's
  // backdrop-blur turns a full-screen fixed overlay into a header-sized box)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onPointer = (e: PointerEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  const pathname = usePathname();
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  const itemClass =
    'flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-black uppercase tracking-wider text-stone-800 hover:bg-gold/15 hover:text-maroon cursor-pointer';

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Account menu"
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-11 items-center gap-1 rounded-full pr-1 ring-2 ring-transparent hover:ring-gold transition-shadow cursor-pointer"
      >
        <Avatar url={avatarUrl} name={fullName} size="md" />
        <ChevronDown className={`size-4 text-stone-600 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          className="fixed inset-x-4 top-20 z-50 sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 sm:mt-2 sm:w-72 rounded-2xl border border-stone-200 bg-white p-2 shadow-xl"
        >
          <div className="flex items-center gap-3 border-b border-stone-100 px-3 pt-2 pb-3 mb-1">
            <Avatar url={avatarUrl} name={fullName} size="md" />
            <div className="min-w-0 space-y-1">
              <p className="truncate text-sm font-bold text-stone-950">{fullName || 'Your account'}</p>
              <RoleBadge role={role} />
            </div>
          </div>
          <Link role="menuitem" href="/dashboard" className={itemClass}>
            <LayoutDashboard className="size-5 shrink-0" aria-hidden="true" /> Dashboard
          </Link>
          <Link role="menuitem" href="/profile" className={itemClass}>
            <UserCircle className="size-5 shrink-0" aria-hidden="true" /> My Profile
          </Link>
          <Link role="menuitem" href="/notifications" className={itemClass}>
            <Bell className="size-5 shrink-0" aria-hidden="true" /> Notifications
          </Link>
          <div className="mt-1 border-t border-stone-100 pt-1">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                logout();
              }}
              className={`${itemClass} text-red-700 hover:bg-red-50 hover:text-red-800`}
            >
              <LogOut className="size-5 shrink-0" aria-hidden="true" /> Log out
            </button>
          </div>
        </div>
      )}
      {logoutDialog}
    </div>
  );
}
