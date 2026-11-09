'use client';

import { useSyncExternalStore } from 'react';
import { createClient } from '@/utils/supabase/client';

// "Is something streaming right now?" for the header LIVE pill and the sticky live banner
// (components/site/LiveNow.tsx). One shared copy for the whole page: it loads when the first
// component subscribes, reloads every minute and stops when nobody listens.
// Logged in: the newest stream marked live (streams are readable by logged-in users).
// Logged out: a live match that has a stream, from get_live_now() (visitors can't read streams);
// the link goes to the public match page, which shows the video.
export interface LiveStreamInfo {
  href: string;
  title: string;
}

let state: LiveStreamInfo | null = null;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

async function load() {
  const supabase = createClient();
  let next: LiveStreamInfo | null = null;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { data } = await supabase
        .from('streams')
        .select('id, title')
        .eq('status', 'live')
        .order('updated_at', { ascending: false })
        .limit(1);
      if (data?.[0]) next = { href: `/live/${data[0].id}`, title: data[0].title };
    } else {
      const { data } = await supabase.rpc('get_live_now');
      const live = (data as unknown as { live?: { id: string; tournament_id: string; team_a: string; team_b: string; has_stream: boolean }[] } | null)?.live ?? [];
      const m = live.find((x) => x.has_stream);
      if (m) next = { href: `/t/${m.tournament_id}/match/${m.id}`, title: `${m.team_a} vs ${m.team_b}` };
    }
  } catch {
    next = null;
  }
  if (next?.href !== state?.href || next?.title !== state?.title) {
    state = next;
    listeners.forEach((l) => l());
  }
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  if (!timer) {
    load();
    timer = setInterval(load, 60_000);
  }
  return () => {
    listeners.delete(notify);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

export function useLiveStream(): LiveStreamInfo | null {
  return useSyncExternalStore(subscribe, () => state, () => null);
}
