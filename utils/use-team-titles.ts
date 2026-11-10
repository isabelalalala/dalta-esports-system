'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';

// Tournament titles per team (Hall of Fame, get_team_titles(): published records, logged-in only)
// for the trophy badge on team cards and team pages. One request for the whole list; teams
// without a title are simply missing from the map. Errors (or the migration not run yet) = no badges.
export function useTeamTitles(teamIds: string[]): Record<string, number> {
  const [titles, setTitles] = useState<Record<string, number>>({});
  const key = [...teamIds].sort().join(',');

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    createClient()
      .rpc('get_team_titles', { p_team_ids: key.split(',') })
      .then(({ data, error }) => {
        if (cancelled || error || !data) return;
        setTitles(Object.fromEntries(data.map((r) => [r.team_id, r.titles])));
      });
    return () => { cancelled = true; };
  }, [key]);

  return titles;
}
