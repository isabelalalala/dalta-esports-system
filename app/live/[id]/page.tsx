'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { useBreadcrumbName } from '@/utils/breadcrumb-names';
import { getErrorMessage } from '@/utils/errors';
import type { Match, Stream } from '@/utils/types';
import { roundLabel } from '@/utils/tournaments';
import { fetchRoundCounts, fetchTeamNames } from '@/utils/matches';
import { streamStatusStyles } from '@/utils/streams';
import FacebookPlayer from '@/components/FacebookPlayer';
import StreamComments from '@/components/StreamComments';
import PageLoading from '@/components/PageLoading';
import PageError from '@/components/PageError';
import { usePageTitle } from '@/utils/page-title';
import { MessageSquare } from 'lucide-react';
import { isOrganizer } from '@/utils/permissions';

// Watch page: Facebook player + a scoreboard that updates in real time
export default function WatchStreamPage() {
  const supabase = createClient();
  usePageTitle('Live stream');
  const [stream, setStream] = useState<Stream | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [teamNames, setTeamNames] = useState<Record<string, string>>({});
  const [roundCount, setRoundCount] = useState(0);
  const [realtimeOn, setRealtimeOn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const params = useParams();
  const id = params?.id as string;
  // Breadcrumb: "Home > Watch Live > <title>"
  useBreadcrumbName(stream?.title);

  // 1. The stream, and record this person's view (once per day; see stream_views)
  useEffect(() => {
    const fetchStream = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data, error: streamError } = await supabase
          .from('streams')
          .select('*, tournaments(id, name, game)')
          .eq('id', id)
          .single();
        if (streamError) throw streamError;
        setStream(data as Stream);

        // ignoreDuplicates: a second visit on the same day changes nothing.
        // A failed view count shouldn't stop anyone from watching, so errors are ignored.
        await supabase
          .from('stream_views')
          .upsert([{ stream_id: id, user_id: session.user.id }], {
            onConflict: 'stream_id,user_id,viewed_on',
            ignoreDuplicates: true,
          });
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to load the stream'));
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchStream();
  }, [id, supabase]);

  // 2. "Watching now" for the Engagement Stats page (stream_presence heartbeat):
  //    the page upserts its row every 45 s while open and deletes it on close.
  //    Rows older than 90 s stop counting. Organizers aren't counted, the same
  //    as in the view counts. A failed heartbeat shouldn't stop anyone from
  //    watching, so errors are ignored — like the stream_views upsert above.
  useEffect(() => {
    if (!id) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;
    let userId = '';

    const join = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: myRole } = await supabase.rpc('get_my_role');
      // Organizers' visits are left out of "watching now"
      if (cancelled || isOrganizer(myRole)) return;
      userId = session.user.id;

      const beat = () => supabase
        .from('stream_presence')
        .upsert({ stream_id: id, user_id: userId }, { onConflict: 'stream_id,user_id' })
        .then(() => undefined, () => undefined);
      await beat();
      if (!cancelled) timer = setInterval(beat, 45_000);
    };
    join();

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      if (userId) {
        supabase.from('stream_presence').delete().eq('stream_id', id).eq('user_id', userId)
          .then(() => undefined, () => undefined);
      }
    };
  }, [id, supabase]);

  // 3. The scoreboard, kept up to date with Supabase Realtime.
  //    A stream linked to a match shows that match; otherwise the tournament's live matches.
  const tournamentId = stream?.tournament_id;
  const matchId = stream?.match_id;

  useEffect(() => {
    if (!tournamentId) return;

    const loadMatches = async () => {
      try {
        const query = supabase.from('matches').select('*');
        const { data, error: matchesError } = matchId
          ? await query.eq('id', matchId)
          : await query.eq('tournament_id', tournamentId).eq('status', 'live').order('match_number');
        if (matchesError) throw matchesError;

        const list = (data || []) as Match[];
        setMatches(list);
        setTeamNames(await fetchTeamNames(supabase, list));
        const counts = await fetchRoundCounts(supabase, [tournamentId]);
        setRoundCount(counts[tournamentId] || 0);
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to load the scoreboard'));
      }
    };

    loadMatches();

    // Any change to this tournament's matches (a score saved, a match going live)
    // reloads the scoreboard. Reloading is simpler than patching the list by hand.
    // Advancing a winner writes several match rows — coalesce to one reload.
    let timer: ReturnType<typeof setTimeout> | null = null;
    const reload = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { loadMatches(); }, 500);
    };
    const channel = supabase
      .channel(`watch-${tournamentId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches', filter: `tournament_id=eq.${tournamentId}` },
        reload
      )
      .subscribe((status) => setRealtimeOn(status === 'SUBSCRIBED'));

    // Stop listening when leaving the page
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [supabase, tournamentId, matchId]);

  if (loading) return <PageLoading />;
  if (!stream) {
    return <PageError message={error || 'Stream not found. It may have been deleted.'} backHref="/live" backLabel="Back to Live Streams" />;
  }

  const name = (teamId: string | null) => (teamId ? teamNames[teamId] ?? 'Unknown team' : 'TBD');
  const pulse = 'inline-block h-1.5 w-1.5 rounded-full bg-current motion-safe:animate-pulse';

  return (
    <div className="w-full text-stone-950">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        <Link href="/live" className="inline-block text-maroon font-bold hover:underline">
          ← All streams
        </Link>

        {/* Title row */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-stone-950 break-words min-w-0">{stream.title}</h1>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-bold uppercase ${streamStatusStyles[stream.status]}`}>
              {stream.status === 'live' ? <><span className={pulse} /> Live</> : stream.status === 'ended' ? 'Replay' : 'Scheduled'}
            </span>
          </div>
          <p className="text-stone-600">
            <Link href={`/tournaments/${stream.tournament_id}`} className="underline hover:text-stone-950">
              {stream.tournaments?.name}
            </Link>
            {' · '}{stream.tournaments?.game}
          </p>
        </div>

        {error && <div role="alert" className="rounded-xl bg-red-500/10 border border-red-500/40 text-red-700 px-4 py-3">{error}</div>}

        {/* Video is the main element; the sidebar (score, and live comments in Phase 4) sits beside it
            on large screens and below it on phones. minmax(0,1fr) lets the video column shrink. */}
        <div className="grid grid-cols-1 @5xl:grid-cols-[minmax(0,1fr)_22rem] gap-4 sm:gap-6 items-start">
          <div className="min-w-0 space-y-3">
            {stream.status === 'scheduled' && (
              <p className="bg-white border border-stone-200/90 rounded-2xl shadow-xs px-4 py-3 text-stone-700">
                This stream hasn&apos;t started yet. The video plays once the broadcast is live on Facebook.
              </p>
            )}
            <div className="rounded-2xl overflow-hidden bg-white border border-stone-200/90 shadow-xs p-2 sm:p-3">
              <FacebookPlayer url={stream.facebook_url} title={stream.title} />
            </div>
          </div>

          <aside className="min-w-0 space-y-4 @5xl:sticky @5xl:top-[calc(var(--site-header-h)+1rem)]" aria-label="Live score">
            <section className="bg-white border border-stone-200/90 rounded-2xl shadow-xs p-4">
              <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
                <h2 className="text-base font-black">{matchId ? 'Match score' : 'Live matches'}</h2>
                <span className={`inline-flex items-center gap-1 text-xs font-semibold ${realtimeOn ? 'text-emerald-700' : 'text-stone-600'}`}>
                  {realtimeOn ? <><span className={pulse} /> Updates live</> : 'Connecting...'}
                </span>
              </div>

              {matches.length === 0 ? (
                <p className="text-stone-600">
                  {matchId ? 'This match is no longer in the bracket.' : 'No match is being played right now.'}
                </p>
              ) : (
                <ul className="space-y-3">
                  {matches.map((m) => {
                    const teamClass = (teamId: string | null) =>
                      m.status === 'completed'
                        ? m.winner_team_id === teamId ? 'text-maroon font-black' : 'text-stone-600'
                        : 'text-stone-950 font-bold';
                    const score = (value: number | null) => value ?? 0;

                    return (
                      <li key={m.id} className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                        <p className="text-xs font-bold uppercase tracking-wide text-stone-600 mb-2 flex flex-wrap items-center gap-2">
                          <span>{roundLabel(m.round, roundCount || m.round)} · Match {m.match_number}</span>
                          {m.status === 'live' && <span className="inline-flex items-center gap-1 text-red-700"><span className={pulse} /> Live</span>}
                          {m.status === 'completed' && <span className="text-stone-600">Final</span>}
                        </p>
                        {/* Two rows (team + score) fit the narrow sidebar better than one wide row */}
                        {[{ id: m.team_a_id, value: m.score_a }, { id: m.team_b_id, value: m.score_b }].map((side, i) => (
                          <div key={i} className="flex items-center justify-between gap-3 text-lg">
                            <span className={`min-w-0 break-words ${teamClass(side.id)}`}>{name(side.id)}</span>
                            <span className="tabular-nums text-2xl font-black text-stone-950">{score(side.value)}</span>
                          </div>
                        ))}
                      </li>
                    );
                  })}
                </ul>
              )}

              <Link href={`/tournaments/${stream.tournament_id}`} className="inline-block mt-4 text-sm font-bold text-maroon hover:underline">
                See the full bracket →
              </Link>
            </section>

            {/* Live chat (or comments on a replay), under the score */}
            <StreamComments streamId={stream.id} replay={stream.status === 'ended'} heightClass="h-[28rem] @5xl:h-96" />

            <Link
              href={`/feedback?tournament=${stream.tournament_id}`}
              className="flex items-center gap-1.5 rounded-2xl border border-stone-200/90 bg-white px-4 py-3 text-maroon font-bold hover:bg-stone-50"
            >
              <MessageSquare className="h-4 w-4 shrink-0" /> Enjoying the stream? Give feedback
            </Link>
          </aside>
        </div>
      </div>
    </div>
  );
}
