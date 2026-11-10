'use client';

import { useSyncExternalStore } from 'react';
import { createClient } from '@/utils/supabase/client';

// "Which games have a live match right now?" for the LIVE dots on the homepage game cards
// (components/site/GameLiveDot.tsx). One shared copy for the page: loads get_live_now() (anyone,
// also logged out; team and tournament names only) when the first dot mounts, reloads every
// minute, stops when no dot is on the page. Maps game_id -> the public match page of its first
// live match (a match with a stream first), which shows the video.
type LiveGames = Record<string, string>;

const EMPTY: LiveGames = {};
let state: LiveGames = EMPTY;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

interface LiveMatch { id: string; tournament_id: string; game_id: string | null; has_stream: boolean }

async function load() {
  let next: LiveGames = {};
  try {
    const { data, error } = await createClient().rpc('get_live_now');
    if (error) throw error;
    const live = [...((data as unknown as { live?: LiveMatch[] } | null)?.live ?? [])]
      // matches with a stream first, so the dot opens a page with video when there is one
      .sort((a, b) => Number(b.has_stream) - Number(a.has_stream));
    for (const m of live) {
      if (m.game_id && !next[m.game_id]) next[m.game_id] = `/t/${m.tournament_id}/match/${m.id}`;
    }
  } catch {
    next = {}; // no dots rather than an error on the homepage
  }
  const changed = Object.keys(next).length !== Object.keys(state).length
    || Object.entries(next).some(([k, v]) => state[k] !== v);
  if (changed) {
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

export function useLiveGames(): LiveGames {
  return useSyncExternalStore(subscribe, () => state, () => EMPTY);
}
