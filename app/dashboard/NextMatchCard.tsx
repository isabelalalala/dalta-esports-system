'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Swords } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useRealtimeRefresh } from '@/utils/use-realtime-refresh';
import { formatDateTime } from '@/utils/tournaments';
import Countdown from '@/components/site/Countdown';
import { LiveTag, VersusBadge, VersusRow } from '@/components/MatchVersus';

interface NextMatch {
  id: string;
  status: 'scheduled' | 'live';
  scheduled_at: string | null;
  myTeam: string;
  opponent: string;
  tournament: string;
}

// Dashboard side column (players): the player's next match with a live countdown, or a live tag
// when it is being played. Hidden when there is none (My Matches lists everything).
export default function NextMatchCard({ userId }: { userId: string }) {
  const supabase = createClient();
  const [match, setMatch] = useState<NextMatch | null>(null);
  const [reloadCount, setReloadCount] = useState(0);
  const reload = useCallback(() => setReloadCount((n) => n + 1), []);
  useRealtimeRefresh(`next-match-${userId}`, [{ table: 'matches' }], reload, 1000);

  useEffect(() => {
    const load = async () => {
      const { data: memberRows } = await supabase.from('team_members').select('team_id').eq('user_id', userId);
      const teamIds = (memberRows || []).map((r) => r.team_id as string);
      if (teamIds.length === 0) return setMatch(null);
      const idList = teamIds.join(',');
      const { data } = await supabase
        .from('matches')
        .select('id, status, scheduled_at, team_a_id, team_b_id, tournaments(name)')
        .or(`team_a_id.in.(${idList}),team_b_id.in.(${idList})`)
        .in('status', ['scheduled', 'live'])
        .order('status', { ascending: true }) // 'live' sorts before 'scheduled'
        .order('scheduled_at', { ascending: true, nullsFirst: false })
        .limit(1);
      const m = data?.[0] as unknown as
        | { id: string; status: 'scheduled' | 'live'; scheduled_at: string | null; team_a_id: string | null; team_b_id: string | null; tournaments: { name: string } | null }
        | undefined;
      if (!m) return setMatch(null);
      const mineIsA = m.team_a_id !== null && teamIds.includes(m.team_a_id);
      const ids = [m.team_a_id, m.team_b_id].filter((id): id is string => Boolean(id));
      const { data: teams } = await supabase.from('teams').select('id, name').in('id', ids);
      const names = Object.fromEntries((teams || []).map((t) => [t.id, t.name]));
      const myId = mineIsA ? m.team_a_id : m.team_b_id;
      const oppId = mineIsA ? m.team_b_id : m.team_a_id;
      setMatch({
        id: m.id,
        status: m.status,
        scheduled_at: m.scheduled_at,
        myTeam: (myId && names[myId]) || 'Your team',
        opponent: (oppId && names[oppId]) || 'TBD',
        tournament: m.tournaments?.name ?? '',
      });
    };
    load();
  }, [supabase, userId, reloadCount]);

  if (!match) return null;

  return (
    <section aria-labelledby="next-match-title" className="rounded-3xl border border-stone-800/80 bg-ink p-5 sm:p-6 text-white shadow-md space-y-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-logo-stage pointer-events-none" aria-hidden="true" />
      <div className="relative flex items-center justify-between gap-2">
        <h2 id="next-match-title" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-gold">
          <Swords className="size-4" aria-hidden="true" /> Your next match
        </h2>
        {match.status === 'live' && <LiveTag />}
      </div>
      <div className="relative">
        <VersusRow size="sm" teamA={<span className="text-white">{match.myTeam}</span>} teamB={<span className="text-white">{match.opponent}</span>} middle={<VersusBadge size="sm" live={match.status === 'live'} />} />
      </div>
      <p className="relative text-center text-xs font-bold text-stone-300 break-words">{match.tournament}</p>
      <div className="relative flex flex-col items-center gap-1 text-center">
        {match.status === 'scheduled' && match.scheduled_at ? (
          <>
            <Countdown target={match.scheduled_at} prefix="Starts in" startedText="Starting now" />
            <span className="text-xs text-stone-400">{formatDateTime(match.scheduled_at)}</span>
          </>
        ) : match.status === 'scheduled' ? (
          <span className="text-sm font-bold text-stone-300">Time TBA</span>
        ) : null}
      </div>
      <Link href={`/matches/${match.id}`} className="relative btn btn-primary w-full">
        Match page (check-in, result)
      </Link>
    </section>
  );
}
