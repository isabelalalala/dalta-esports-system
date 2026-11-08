import { useEffect, useSyncExternalStore } from 'react';
import { createClient } from '@/utils/supabase/client';

// Who is viewing: one shared copy for the header, navigation, bottom bar and tour, so they don't
// each fetch the session and profile. Updates on log in / log out; call refreshViewer() after
// changing your own name or picture.
//
// role is null for logged-out visitors (the navigation treats them as spectators). This is for
// deciding what to SHOW; every action is checked again by RLS / the database.

export interface Viewer {
  status: 'loading' | 'ready';
  userId: string | null;
  role: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  tourDismissed: boolean;
  // Moderation (202611081500): 'none' | 'pending' (flagged at 5 warnings) | 'banned'
  banStatus: string;
  // Active warnings (the profile shows the list)
  warningCount: number;
}

const LOADING: Viewer = {
  status: 'loading', userId: null, role: null, fullName: null, avatarUrl: null, tourDismissed: true,
  banStatus: 'none', warningCount: 0,
};

let state: Viewer = LOADING;
let started = false;
const listeners = new Set<() => void>();

function set(next: Viewer) {
  state = next;
  listeners.forEach((notify) => notify());
}

export async function refreshViewer() {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    set({ ...LOADING, status: 'ready' });
    return;
  }
  // select('*'): works before and after the avatar/tour and moderation migrations
  const [{ data }, warnings] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle(),
    // Before the moderation migration the table doesn't exist: the count is then 0
    supabase.from('user_warnings').select('id', { count: 'exact', head: true })
      .eq('user_id', session.user.id).is('removed_at', null),
  ]);
  const row = (data ?? {}) as {
    role?: string; full_name?: string | null; avatar_url?: string | null; tour_dismissed_at?: string | null;
    ban_status?: string;
  };
  set({
    status: 'ready',
    userId: session.user.id,
    role: row.role ?? null,
    fullName: row.full_name ?? null,
    avatarUrl: row.avatar_url ?? null,
    // Before the migration the column doesn't exist: don't show the tour then
    tourDismissed: !('tour_dismissed_at' in row) || !!row.tour_dismissed_at,
    banStatus: row.ban_status ?? 'none',
    warningCount: warnings.count ?? 0,
  });
}

function start() {
  if (started) return;
  started = true;
  refreshViewer().catch(() => set({ ...LOADING, status: 'ready' }));
  createClient().auth.onAuthStateChange((event) => {
    // Token refreshes don't change who is viewing
    if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
      refreshViewer().catch(() => undefined);
    }
  });
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
}

export function useViewer(): Viewer {
  useEffect(start, []);
  return useSyncExternalStore(subscribe, () => state, () => LOADING);
}
