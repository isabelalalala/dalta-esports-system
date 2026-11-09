'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import type { TeamListEntry } from '@/utils/types';
import { teamBadges, teamSlots } from '@/utils/team-cards';
import TeamLogo from '@/components/TeamLogo';
import StatusBadge from '@/components/StatusBadge';
import GameBadge from '@/components/GameBadge';

// Dashboard side column (players): the player's teams with roster slots and status, linking to
// each team page. Same data as the "My teams" cards (list_teams with p_mine).
export default function MyTeamsSummary() {
  const supabase = createClient();
  const [teams, setTeams] = useState<TeamListEntry[] | null>(null);

  useEffect(() => {
    supabase.rpc('list_teams', { p_mine: true, p_limit: 10 }).then(({ data, error }) => {
      setTeams(error ? [] : ((data || []) as unknown as TeamListEntry[]));
    });
  }, [supabase]);

  if (teams === null) return null;

  return (
    <section aria-labelledby="my-teams-title" className="rounded-3xl border border-stone-200/90 bg-white p-5 sm:p-6 shadow-xs space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 id="my-teams-title" className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-widest text-stone-950">
          <Users className="size-4 text-maroon" aria-hidden="true" /> My teams
        </h2>
        <Link href="/teams?tab=mine" className="text-xs font-black uppercase tracking-wider text-maroon hover:underline">All →</Link>
      </div>
      {teams.length === 0 ? (
        <div className="space-y-3 text-sm text-stone-600">
          <p>You&apos;re not on a team yet.</p>
          <Link href="/teams?tab=all&recruiting=1" className="btn btn-secondary">Find a team</Link>
        </div>
      ) : (
        <ul className="divide-y divide-stone-100">
          {teams.map((t) => {
            const slots = teamSlots(t.member_count, t.max_players);
            const badge = teamBadges(t).find((b) => b !== 'yours');
            return (
              <li key={t.id}>
                <Link href={`/teams/${t.id}`} className="flex items-center gap-3 py-2.5 rounded-xl hover:bg-stone-50 transition-colors">
                  <TeamLogo url={t.logo_url} name={t.name} gameId={t.game_id} gameName={t.game_name} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-black text-stone-950">{t.name}</span>
                    <span className="flex min-w-0 items-center gap-1 text-xs text-stone-600"><GameBadge name={t.game_name} game={t.game_id} size="xs" withName /><span className="shrink-0">· {slots.label}</span></span>
                  </span>
                  {badge && <StatusBadge kind={badge} />}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
