'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import { fetchSplits, type MyPrediction, type PickMatch, type Splits } from '@/utils/predictions';

interface PredictionsState {
  // false until the session and the picks are loaded (buttons are hidden until then)
  loaded: boolean;
  loggedIn: boolean;
  isOrganizer: boolean;
  // Teams the user plays for (they can't pick those matches)
  myTeamIds: string[];
  splits: Splits;
  // matchId -> the user's own pick
  myPicks: Record<string, MyPrediction>;
  // Current time (ms), refreshed every 30 seconds, for the "picks close at match time" rule
  now: number;
  // Picks a team, changes the pick, or removes it (same team again).
  // Returns an error message, or null when it worked.
  pick: (matchId: string, teamId: string) => Promise<string | null>;
}

const PredictionsContext = createContext<PredictionsState | null>(null);

export function usePredictions() {
  return useContext(PredictionsContext);
}

// Loads the community split for every given match (2 requests for a whole bracket instead of
// 2 per match) and, when logged in, the user's own picks. Wrap a bracket or a match page with it
// and put <PredictionPicker> inside.
export default function PredictionsProvider({ matches, children }: { matches: PickMatch[]; children: ReactNode }) {
  const supabase = createClient();
  const [loaded, setLoaded] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [myTeamIds, setMyTeamIds] = useState<string[]>([]);
  const [splits, setSplits] = useState<Splits>({});
  const [myPicks, setMyPicks] = useState<Record<string, MyPrediction>>({});
  const [now, setNow] = useState(0);
  // Increase this to load everything again (after a pick)
  const [reloadCount, setReloadCount] = useState(0);

  // Reload when the matches change (a result sets is_correct, a match goes live)
  const matchKey = matches.map((m) => `${m.id}:${m.status}:${m.winner_team_id ?? ''}`).join(',');
  const matchIds = useMemo(() => matchKey.split(',').filter(Boolean).map((k) => k.split(':')[0]), [matchKey]);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = setInterval(tick, 30_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        setSplits(await fetchSplits(supabase, matchIds));

        const { data: { session } } = await supabase.auth.getSession();
        setLoggedIn(!!session);
        if (!session || matchIds.length === 0) return;

        const [roleRes, picksRes, teamsRes] = await Promise.all([
          supabase.rpc('get_my_role'),
          supabase.from('predictions').select('id, match_id, predicted_winner_team_id, is_correct').in('match_id', matchIds),
          supabase.from('team_members').select('team_id').eq('user_id', session.user.id),
        ]);
        if (roleRes.error) throw roleRes.error;
        if (picksRes.error) throw picksRes.error;
        if (teamsRes.error) throw teamsRes.error;
        setIsOrganizer(roleRes.data === 'admin' || roleRes.data === 'staff');
        setMyPicks(Object.fromEntries((picksRes.data as MyPrediction[]).map((p) => [p.match_id, p])));
        setMyTeamIds((teamsRes.data || []).map((t) => t.team_id as string));
      } catch {
        // Picks are extra: if they can't load, the page still works (the split just stays empty)
      } finally {
        setLoaded(true);
      }
    };
    load();
  }, [supabase, matchIds, reloadCount]);

  const pick = useCallback(async (matchId: string, teamId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return 'Please log in to make a pick.';

      const existing = myPicks[matchId];
      // The database checks the lock, the teams and "not your own match"
      if (existing && existing.predicted_winner_team_id === teamId) {
        const { data, error } = await supabase.from('predictions').delete().eq('id', existing.id).select('id');
        if (error) throw error;
        if (!data || data.length === 0) throw new Error('Your pick could not be removed.');
      } else if (existing) {
        const { data, error } = await supabase.from('predictions')
          .update({ predicted_winner_team_id: teamId }).eq('id', existing.id).select('id');
        if (error) throw error;
        if (!data || data.length === 0) throw new Error('Your pick could not be changed.');
      } else {
        const { error } = await supabase.from('predictions')
          .insert({ user_id: session.user.id, match_id: matchId, predicted_winner_team_id: teamId });
        if (error) throw error;
      }
      setReloadCount((n) => n + 1);
      return null;
    } catch (err) {
      return getErrorMessage(err, 'Your pick could not be saved.');
    }
  }, [supabase, myPicks]);

  return (
    <PredictionsContext.Provider value={{ loaded, loggedIn, isOrganizer, myTeamIds, splits, myPicks, now, pick }}>
      {children}
    </PredictionsContext.Provider>
  );
}
