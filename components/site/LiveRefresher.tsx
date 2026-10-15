'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

// Keeps a public tournament page current: reloads the page's data when one of its matches
// changes (Supabase Realtime; logged-out visitors may read matches), and once a minute
// for things Realtime doesn't send to visitors (a stream going live). Renders nothing.
export default function LiveRefresher({ tournamentId }: { tournamentId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    // Several matches change at once when a winner advances; refresh once for all of them
    let timer: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 500);
    };

    const channel = supabase
      .channel(`public-tournament-${tournamentId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `tournament_id=eq.${tournamentId}` }, refresh)
      .subscribe();
    const minute = setInterval(() => router.refresh(), 60_000);

    return () => {
      if (timer) clearTimeout(timer);
      clearInterval(minute);
      supabase.removeChannel(channel);
    };
  }, [router, tournamentId]);

  return null;
}
