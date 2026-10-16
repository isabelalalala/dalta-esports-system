'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import type { Match, Stream } from '@/utils/types';
import { roundLabel } from '@/utils/tournaments';
import { fetchRoundCounts, fetchTeamNames } from '@/utils/matches';
import { streamStatusStyles } from '@/utils/streams';
import FacebookPlayer from '@/components/FacebookPlayer';
import PageLoading from '@/components/PageLoading';
import PageError from '@/components/PageError';
import { usePageTitle } from '@/utils/page-title';

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
        setStream(data);

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
      if (cancelled || myRole === 'admin' || myRole === 'staff') return;
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
    const channel = supabase
      .channel(`watch-${tournamentId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches', filter: `tournament_id=eq.${tournamentId}` },
        () => { loadMatches(); }
      )
      .subscribe((status) => setRealtimeOn(status === 'SUBSCRIBED'));

    // Stop listening when leaving the page
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, tournamentId, matchId]);

  if (loading) return <PageLoading />;
  if (!stream) {
    return <PageError message={error || 'Stream not found. It may have been deleted.'} backHref="/live" backLabel="Back to Live Streams" />;
  }

  const name = (teamId: string | null) => (teamId ? teamNames[teamId] ?? 'Unknown team' : 'TBD');

  return (
    <main id="main-content" className="min-h-screen bg-sitebg text-white px-4 py-10">
      <div className="max-w-5xl mx-auto space-y-6">
        <Link href="/live" className="inline-block text-gold hover:underline">
          ← All streams
        </Link>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-gold break-words min-w-0">{stream.title}</h1>
            <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase ${streamStatusStyles[stream.status]}`}>
              {stream.status === 'live' ? '● Live' : stream.status === 'ended' ? 'Replay' : 'Scheduled'}
            </span>
          </div>
          <p className="text-gray-400">
            <Link href={`/tournaments/${stream.tournament_id}`} className="underline hover:text-white">
              {stream.tournaments?.name}
            </Link>
            {' · '}{stream.tournaments?.game}
          </p>
        </div>

        {error && <div role="alert" className="bg-red-500/10 border border-red-500 text-red-300 px-4 py-3">{error}</div>}

        {stream.status === 'scheduled' && (
          <p className="bg-sitecard border border-brownlight px-4 py-3 text-gray-300">
            This stream hasn&apos;t started yet. The video plays once the broadcast is live on Facebook.
          </p>
        )}

        <FacebookPlayer url={stream.facebook_url} title={stream.title} />

        {/* Scoreboard */}
        <section className="bg-sitecard border border-brownlight p-4 sm:p-6">
          <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
            <h2 className="text-xl font-bold">{matchId ? 'Match' : 'Live matches'}</h2>
            <span className={`text-xs ${realtimeOn ? 'text-green-400' : 'text-gray-400'}`}>
              {realtimeOn ? '● Updates automatically' : 'Connecting...'}
            </span>
          </div>

          {matches.length === 0 ? (
            <p className="text-gray-400">
              {matchId ? 'This match is no longer in the bracket.' : 'No match is being played right now.'}
            </p>
          ) : (
            <ul className="divide-y divide-brown">
              {matches.map((m) => {
                const teamClass = (teamId: string | null) =>
                  m.status === 'completed'
                    ? m.winner_team_id === teamId ? 'text-gold font-bold' : 'text-gray-400'
                    : 'text-white font-semibold';

                return (
                  <li key={m.id} className="py-3">
                    <p className="text-xs text-gray-400 mb-1">
                      {roundLabel(m.round, roundCount || m.round)} · Match {m.match_number}
                      {m.status === 'live' && <span className="ml-2 text-red-400 font-bold">● LIVE</span>}
                      {m.status === 'completed' && <span className="ml-2 text-gray-400 font-bold">FINAL</span>}
                    </p>
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-lg">
                      <span className={`truncate ${teamClass(m.team_a_id)}`}>{name(m.team_a_id)}</span>
                      <span className="tabular-nums text-2xl font-bold text-white">
                        {m.score_a ?? 0} : {m.score_b ?? 0}
                      </span>
                      <span className={`truncate text-right ${teamClass(m.team_b_id)}`}>{name(m.team_b_id)}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <Link href={`/tournaments/${stream.tournament_id}`} className="inline-block mt-4 text-sm text-gold hover:underline">
            See the full bracket →
          </Link>
        </section>

        <Link
          href={`/feedback?tournament=${stream.tournament_id}`}
          className="inline-block text-gold hover:underline"
        >
          💬 Enjoying the stream? Give feedback
        </Link>
      </div>
    </main>
  );
}
