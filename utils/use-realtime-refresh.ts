import { useEffect, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';

export interface RealtimeSource {
  table: string;
  // PostgREST-style filter, e.g. `team_id=eq.<uuid>`. Supabase can't filter DELETE events, so
  // a filtered source also listens to that table's deletes unfiltered (the page just reloads).
  filter?: string;
}

// Calls onChange when any of the given tables change (Supabase Realtime), at most once per
// `delayMs` (one change often touches several rows, e.g. a winner advancing in the bracket).
// The subscription is removed when the component unmounts or the sources change, so leaving the
// page stops it. Pass key = null to stay unsubscribed (e.g. until an id is known).
//
// Realtime only delivers rows the user may read (RLS), and only for tables in the
// supabase_realtime publication (see the migrations).
export function useRealtimeRefresh(
  key: string | null,
  sources: RealtimeSource[],
  onChange: () => void,
  delayMs = 400,
) {
  // Keep the latest callback without re-subscribing every render
  const callback = useRef(onChange);
  useEffect(() => {
    callback.current = onChange;
  }, [onChange]);

  const sourcesKey = JSON.stringify(sources);

  useEffect(() => {
    if (!key) return;
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const fire = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => callback.current(), delayMs);
    };

    // A unique topic, so two components watching the same thing don't share (and close) a channel
    let channel = supabase.channel(`${key}-${Math.random().toString(36).slice(2, 10)}`);
    for (const source of JSON.parse(sourcesKey) as RealtimeSource[]) {
      if (source.filter) {
        for (const event of ['INSERT', 'UPDATE'] as const) {
          channel = channel.on('postgres_changes', { event, schema: 'public', table: source.table, filter: source.filter }, fire);
        }
        channel = channel.on('postgres_changes', { event: 'DELETE', schema: 'public', table: source.table }, fire);
      } else {
        channel = channel.on('postgres_changes', { event: '*', schema: 'public', table: source.table }, fire);
      }
    }
    channel.subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [key, sourcesKey, delayMs]);
}
