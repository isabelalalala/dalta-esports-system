'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import type { Match, Profile, Stream, StreamStatus, Tournament } from '@/utils/types';
import { roundLabel } from '@/utils/tournaments';
import { fetchTeamNames } from '@/utils/matches';
import { FACEBOOK_LINK_HELP, parseFacebookInput, streamStatusStyles } from '@/utils/streams';
import FacebookPlayer from '@/components/FacebookPlayer';
import PageLoading from '@/components/PageLoading';
import PageError from '@/components/PageError';
import { usePageTitle } from '@/utils/page-title';
import PageHeroBackground from '@/components/site/PageHeroBackground';
import {
  AlertCircle,
  CircleCheck,
  Edit2,
  Plus,
  Radio,
  Swords,
  Trash2,
  Tv,
  Video,
} from 'lucide-react';
import { can } from '@/utils/permissions';

const inputClass =
  'w-full border border-stone-300 bg-stone-50 px-4 py-3.5 text-stone-950 font-bold text-xs rounded-xl outline-none focus:border-amber-600 focus:bg-white focus:ring-2 focus:ring-amber-500/20 transition-all placeholder:text-stone-400 shadow-xs';
const labelClass = 'block text-stone-950 text-xs font-black tracking-wider uppercase mb-2';

export default function ManageStreamsPage() {
  usePageTitle('Tournament streams');
  const supabase = createClient();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [matchLabels, setMatchLabels] = useState<Record<string, string>>({});
  const [profile, setProfile] = useState<Pick<Profile, 'id' | 'role'> | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadCount, setReloadCount] = useState(0);

  const params = useParams();
  const id = params?.id as string;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, role')
          .eq('id', session.user.id)
          .single();
        if (profileError) throw profileError;
        setProfile(profileData);

        const [tournRes, streamsRes, matchesRes] = await Promise.all([
          supabase.from('tournaments').select('*').eq('id', id).single(),
          supabase
            .from('streams')
            .select('*')
            .eq('tournament_id', id)
            .order('created_at', { ascending: false }),
          supabase
            .from('matches')
            .select('*')
            .eq('tournament_id', id)
            .order('round')
            .order('match_number'),
        ]);

        if (tournRes.error) throw tournRes.error;
        if (streamsRes.error) throw streamsRes.error;
        if (matchesRes.error) throw matchesRes.error;

        setTournament(tournRes.data as Tournament);
        setStreams((streamsRes.data || []) as Stream[]);

        const matches = (matchesRes.data || []) as Match[];
        const roundCount = matches.reduce((max, m) => Math.max(max, m.round), 0);
        const names = await fetchTeamNames(supabase, matches);

        const labels: Record<string, string> = {};
        for (const m of matches) {
          const a = m.team_a_id ? names[m.team_a_id] ?? 'TBD' : 'TBD';
          const b = m.team_b_id ? names[m.team_b_id] ?? 'TBD' : 'TBD';
          labels[m.id] = `${roundLabel(m.round, roundCount)}: ${a} vs ${b}`;
        }
        setMatchLabels(labels);
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to load streams'));
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchData();
  }, [id, supabase, reloadCount]);

  const setStatus = async (stream: Stream, status: StreamStatus) => {
    setError('');
    try {
      const { data, error: updateError } = await supabase
        .from('streams')
        .update({ status })
        .eq('id', stream.id)
        .select('id');
      if (updateError) throw updateError;
      if (!data || data.length === 0) throw new Error('Only admin and staff can change stream status.');
      setReloadCount((n) => n + 1);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update stream status'));
    }
  };

  const handleDelete = async (stream: Stream) => {
    if (!confirm(`Delete the stream "${stream.title}"? Its viewing stats are deleted too.`)) return;
    setError('');
    try {
      const { data, error: deleteError } = await supabase
        .from('streams')
        .delete()
        .eq('id', stream.id)
        .select('id');
      if (deleteError) throw deleteError;
      if (!data || data.length === 0) throw new Error('Only admin and staff can delete streams.');
      setReloadCount((n) => n + 1);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to delete the stream'));
    }
  };

  const afterSave = () => {
    setShowForm(false);
    setEditingId(null);
    setReloadCount((n) => n + 1);
  };

  if (loading) return <PageLoading />;
  if (!tournament) {
    return <PageError message={error || 'Tournament not found. It may have been deleted.'} backHref="/tournaments" backLabel="Back to Tournaments" />;
  }

  if (!can(profile?.role, 'stream.configure')) {
    return (
      <div className="w-full p-12 text-center text-xs font-black tracking-wider text-stone-600">
        Only organizers can configure streams.{' '}
        <Link href="/live" className="text-maroon underline hover:text-gold">Watch live streams</Link>
      </div>
    );
  }

  return (
    <div className="w-full space-y-8 text-stone-950">
      {/* 1. Main Hero Container */}
      <section className="relative w-full rounded-3xl border border-stone-800/80 bg-stone-950 overflow-hidden shadow-md p-8 sm:p-12 lg:p-14 text-center text-white flex flex-col items-center justify-center space-y-4">
        <PageHeroBackground specificKey="tournaments_hero_bg_path" alt="DALTA Esports Banner" />

        <div className="relative z-10 w-full flex flex-wrap items-center justify-between gap-4">
          <Link
            href={`/tournaments/${id}`}
            className="inline-flex items-center gap-1.5 text-xs font-black text-gold hover:text-goldlight uppercase tracking-wider transition-colors"
          >
            ← Back to Tournament
          </Link>
          <span className="text-xs font-black text-stone-300 uppercase tracking-wider flex items-center gap-1.5">
            <Radio className="w-4 h-4 text-gold" /> Facebook Live Broadcast
          </span>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto space-y-3 pt-2">
          <h1
            className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-wider uppercase leading-tight text-white"
          >
            Manage Streams
          </h1>
          <p
            className="text-xs sm:text-sm font-semibold leading-relaxed text-white"
          >
            {tournament.name} · Configure live broadcasts, link match fixtures, and manage on-air streams.
          </p>
        </div>

        {!showForm && !editingId && (
          <div className="relative z-10 pt-2">
            <button
              onClick={() => { setShowForm(true); setEditingId(null); }}
              className="px-6 py-3 rounded-xl bg-gold hover:bg-golddark text-stone-950 font-black text-xs uppercase tracking-widest border border-amber-400 shadow-xs hover:-translate-y-0.5 transition-all inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Stream</span>
            </button>
          </div>
        )}
      </section>

      {/* 2. Error Notice */}
      {error && (
        <div role="alert" className="rounded-2xl bg-red-500/10 border border-red-500/30 p-4 sm:p-5 text-red-700 text-xs sm:text-sm font-bold tracking-wider flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* 3. Add / Edit Stream Studio Form */}
      {(showForm || editingId) && profile && (
        <div className="max-w-4xl mx-auto w-full">
          <StreamForm
            existing={editingId ? streams.find((s) => s.id === editingId) : undefined}
            tournamentId={id}
            userId={profile.id}
            matchLabels={matchLabels}
            onSaved={afterSave}
            onCancel={() => { setShowForm(false); setEditingId(null); }}
          />
        </div>
      )}

      {/* 4. Stream Feed Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-200/90 pb-3">
        <div>
          <span className="text-[11px] font-black tracking-widest text-maroon uppercase">Broadcast Roster</span>
          <h2 className="text-xl sm:text-2xl font-black text-stone-950 uppercase tracking-wide">
            Configured Streams ({streams.length})
          </h2>
        </div>
        {!showForm && !editingId && streams.length > 0 && (
          <button
            onClick={() => { setShowForm(true); setEditingId(null); }}
            className="px-4 py-2 rounded-xl bg-gold hover:bg-golddark text-stone-950 font-black text-xs uppercase tracking-wider border border-amber-400 shadow-xs hover:-translate-y-0.5 transition-all inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Stream</span>
          </button>
        )}
      </div>

      {/* 5. Streams Showcase Grid */}
      {streams.length === 0 && !error && !showForm && !editingId ? (
        <div className="rounded-3xl border border-stone-200/90 bg-white p-12 text-center shadow-xs flex flex-col items-center justify-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-maroon flex items-center justify-center">
            <Tv className="w-7 h-7" />
          </div>
          <p className="text-stone-900 text-sm font-black">
            No live streams configured for this tournament yet.
          </p>
          <p className="text-xs text-stone-500 font-semibold max-w-md">
            Link a Facebook Live video to enable in-system live streaming for participants and spectators.
          </p>
          <button
            onClick={() => { setShowForm(true); setEditingId(null); }}
            className="mt-2 px-6 py-3 rounded-xl bg-gold hover:bg-golddark text-stone-950 font-black text-xs uppercase tracking-widest border border-amber-400 shadow-xs hover:-translate-y-0.5 transition-all"
          >
            + Add First Stream
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {streams.map((stream) => (
            <div
              key={stream.id}
              className="rounded-3xl border border-stone-200/90 bg-white overflow-hidden shadow-xs hover:border-amber-400/50 hover:shadow-md transition-all flex flex-col"
            >
              {/* Embedded Player in Card */}
              <div className="w-full border-b border-stone-100 pb-2 px-3 pt-3">
                <FacebookPlayer url={stream.facebook_url} title={stream.title} />
              </div>

              {/* Stream Meta & Controls */}
              <div className="p-6 space-y-4 flex-1 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className={`px-2.5 py-1 rounded-md border text-[10px] font-black uppercase shadow-2xs ${streamStatusStyles[stream.status]}`}>
                      {stream.status === 'live' ? (
                        <span className="flex items-center gap-1.5 text-red-700">
                          <span className="inline-block h-2 w-2 rounded-full bg-red-600 animate-ping" />
                          LIVE ON AIR
                        </span>
                      ) : (
                        stream.status
                      )}
                    </span>
                    {stream.match_id && (
                      <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider flex items-center gap-1">
                        <Swords className="w-3.5 h-3.5 text-maroon" />
                        {matchLabels[stream.match_id] ?? 'Linked Match'}
                      </span>
                    )}
                  </div>

                  <h3 className="text-base sm:text-lg font-black text-stone-950 uppercase tracking-wide">
                    {stream.title}
                  </h3>

                  <p className="text-xs text-stone-500 font-mono truncate">
                    {stream.facebook_url}
                  </p>
                </div>

                {/* Staff Actions */}
                <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-stone-100">
                  {stream.status !== 'live' && (
                    <button
                      onClick={() => setStatus(stream, 'live')}
                      className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-widest shadow-xs hover:-translate-y-0.5 transition-all"
                    >
                      Go Live
                    </button>
                  )}
                  {stream.status === 'live' && (
                    <button
                      onClick={() => setStatus(stream, 'ended')}
                      className="px-4 py-2 rounded-xl bg-stone-700 hover:bg-stone-800 text-white font-black text-xs uppercase tracking-widest shadow-xs hover:-translate-y-0.5 transition-all"
                    >
                      End Stream
                    </button>
                  )}
                  <Link
                    href={`/live/${stream.id}`}
                    className="px-4 py-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-950 font-black text-xs uppercase tracking-wider transition-all"
                  >
                    Watch Page ↗
                  </Link>
                  <button
                    onClick={() => { setEditingId(stream.id); setShowForm(false); }}
                    className="px-3.5 py-2 rounded-xl border border-amber-400/80 bg-amber-50 text-amber-950 font-black text-xs uppercase tracking-wider hover:bg-amber-100 transition-all inline-flex items-center gap-1"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={() => handleDelete(stream)}
                    className="px-3.5 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 font-black text-xs uppercase tracking-wider hover:bg-rose-100 transition-all inline-flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// What staff must set on Facebook so the embedded player can show the stream
const STREAM_CHECKLIST = [
  'The stream comes from a Facebook Page, not a personal profile.',
  'The video\'s privacy is set to Public.',
  'Embedding is allowed (Live Producer → Settings → "Allow embedding").',
  'No age or country restrictions on the Page or the video.',
];

type LinkCheck =
  | { state: 'idle' }
  | { state: 'checking' }
  // embeddable: 'checking' while the server asks Facebook, false = Facebook says it can't be shown,
  // null = couldn't tell (most working videos)
  | { state: 'ok'; canonicalUrl: string; videoId: string | null; embeddable: false | null | 'checking' }
  | { state: 'error'; message: string };

function StreamForm({
  existing,
  tournamentId,
  userId,
  matchLabels,
  onSaved,
  onCancel,
}: {
  existing?: Stream;
  tournamentId: string;
  userId: string;
  matchLabels: Record<string, string>;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const supabase = createClient();
  const [title, setTitle] = useState(existing?.title ?? '');
  const [url, setUrl] = useState(existing?.facebook_url ?? '');
  const [matchId, setMatchId] = useState(existing?.match_id ?? '');
  const [status, setStatus] = useState<StreamStatus>(existing?.status ?? 'scheduled');
  const [check, setCheck] = useState<LinkCheck>({ state: 'idle' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Check the link as staff type or paste. Links that already name the video are canonicalized in
  // the browser right away; the server then follows share links (/share/v/, fb.watch) and asks
  // Facebook's embed player whether the video can be shown (POST /api/streams/resolve-url).
  useEffect(() => {
    const value = url.trim();
    const parsed = value ? parseFacebookInput(value) : null;
    let cancelled = false;

    // Every state change happens in a timer so typing doesn't re-render on each key
    const timer = setTimeout(async () => {
      if (!parsed) return setCheck({ state: 'idle' });
      if (parsed.kind === 'invalid') return setCheck({ state: 'error', message: parsed.message });
      if (parsed.kind === 'video') {
        setCheck({ state: 'ok', canonicalUrl: parsed.canonicalUrl, videoId: parsed.videoId, embeddable: 'checking' });
      } else {
        setCheck({ state: 'checking' });
      }
      try {
        const res = await fetch('/api/streams/resolve-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: value }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) setCheck({ state: 'error', message: data.error || FACEBOOK_LINK_HELP });
        else setCheck({ state: 'ok', canonicalUrl: data.canonicalUrl, videoId: data.videoId ?? null, embeddable: data.embeddable ?? null });
      } catch {
        if (cancelled) return;
        // The link itself was fine; only the embed check failed: keep it, without a verdict
        if (parsed.kind === 'video') {
          setCheck({ state: 'ok', canonicalUrl: parsed.canonicalUrl, videoId: parsed.videoId, embeddable: null });
        } else {
          setCheck({ state: 'error', message: FACEBOOK_LINK_HELP });
        }
      }
    }, 600);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [url]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (check.state !== 'ok') {
      setError(check.state === 'error' ? check.message : 'Wait for the link check to finish.');
      return;
    }
    setSaving(true);
    setError('');

    // Always save the canonical address (never the share link) plus the video id
    const fields = {
      title: title.trim(),
      facebook_url: check.canonicalUrl,
      facebook_video_id: check.videoId,
      match_id: matchId || null,
      status,
    };

    try {
      const { data, error: saveError } = existing
        ? await supabase.from('streams').update(fields).eq('id', existing.id).select('id')
        : await supabase.from('streams').insert([{ ...fields, tournament_id: tournamentId, created_by: userId }]).select('id');
      if (saveError) throw saveError;
      if (!data || data.length === 0) throw new Error('Only admin and staff can configure streams.');
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save the stream'));
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-3xl border border-amber-400/80 bg-white p-4 sm:p-8 lg:p-10 shadow-md space-y-6"
    >
      <div className="border-b border-stone-100 pb-3">
        <span className="text-[11px] font-black tracking-widest text-maroon uppercase">Broadcast Studio</span>
        <h2 className="text-xl sm:text-2xl font-black text-stone-950 uppercase tracking-wide flex items-center gap-2">
          <Video className="w-5 h-5 text-maroon" /> {existing ? 'Edit Broadcast Stream' : 'Configure New Live Stream'}
        </h2>
      </div>

      {error && (
        <div role="alert" className="rounded-2xl bg-red-500/10 border border-red-500/30 p-4 text-red-700 text-sm font-bold flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Stream checklist: the usual reasons a live stream shows "no permission" on our site */}
      <details open={!existing} className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
        <summary className="cursor-pointer text-xs font-black tracking-wider text-stone-950">
          Stream checklist (before you go live)
        </summary>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-stone-800">
          {STREAM_CHECKLIST.map((item) => (
            <li key={item} className="flex gap-2">
              <CircleCheck className="w-4 h-4 mt-0.5 shrink-0 text-maroon" aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm leading-relaxed text-stone-600">
          Best link: open the video on its own page, then ⋯ → &quot;Copy link&quot;. Share links, fb.watch links and
          embed code also work: we look up the video for you.
        </p>
      </details>

      <div>
        <label htmlFor="stream-title" className={labelClass}>
          Broadcast Title *
        </label>
        <input
          id="stream-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Grand Finals: DALTA Valorant Cup"
          className={inputClass}
          required
        />
      </div>

      <div>
        <label htmlFor="stream-url" className={labelClass}>
          Facebook video link or embed code *
        </label>
        {/* type="text", not "url": embed code isn't a URL */}
        <input
          id="stream-url"
          type="text"
          inputMode="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.facebook.com/yourpage/videos/123... or a share link"
          className={inputClass}
          required
        />
        <div aria-live="polite" className="mt-2 text-sm font-bold">
          {check.state === 'checking' && <p className="text-stone-600">Checking the link with Facebook...</p>}
          {check.state === 'error' && <p className="text-red-700">{check.message}</p>}
          {check.state === 'ok' && (
            <div className="space-y-1">
              <p className="inline-flex items-center gap-1.5 text-emerald-800">
                <CircleCheck className="h-4 w-4 shrink-0" /> Video found{check.videoId ? ` (id ${check.videoId})` : ''}.
                Check the preview below before saving.
              </p>
              {check.canonicalUrl !== url.trim() && (
                <p className="font-medium text-stone-600 break-all">Will be saved as: {check.canonicalUrl}</p>
              )}
              {check.embeddable === 'checking' && (
                <p className="font-medium text-stone-600">Asking Facebook whether the video can be embedded...</p>
              )}
              {check.embeddable === false && (
                <p role="alert" className="rounded-xl border border-yellow-500/50 bg-yellow-50 p-3 font-semibold text-stone-950">
                  Facebook says this video can&apos;t be shown here (&quot;Video unavailable / you don&apos;t have
                  permission&quot;). Viewers will see that message instead of the stream. Go through the checklist above:
                  usually the video isn&apos;t Public, is on a personal profile, or has embedding turned off. You can
                  still save it and fix the settings on Facebook.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="stream-match" className={labelClass}>
            Linked Match (Bracket Fixture)
          </label>
          <select id="stream-match" value={matchId} onChange={(e) => setMatchId(e.target.value)} className={inputClass}>
            <option value="">Whole Tournament (No single match)</option>
            {Object.entries(matchLabels).map(([mid, label]) => (
              <option key={mid} value={mid}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="stream-status" className={labelClass}>
            Broadcast Status
          </label>
          <select id="stream-status" value={status} onChange={(e) => setStatus(e.target.value as StreamStatus)} className={inputClass}>
            <option value="scheduled">Scheduled</option>
            <option value="live">Live Now (On Air)</option>
            <option value="ended">Ended (VOD / Replay)</option>
          </select>
        </div>
      </div>

      {/* Preview of exactly what viewers will see (the canonical address) */}
      {check.state === 'ok' && (
        <div className="space-y-2 pt-2">
          <span className="text-xs font-black uppercase text-stone-600 tracking-wider">Preview</span>
          <div className="rounded-2xl border border-stone-200 overflow-hidden shadow-md p-2">
            <FacebookPlayer url={check.canonicalUrl} title="Broadcast preview" />
          </div>
          <p className="text-sm text-stone-600">
            If the preview says the video is unavailable or you don&apos;t have permission, go through the checklist above.
          </p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 pt-3 border-t border-stone-100">
        <button
          type="submit"
          disabled={saving || check.state !== 'ok'}
          className="px-6 py-3.5 rounded-xl bg-gold hover:bg-golddark text-stone-950 font-black text-xs uppercase tracking-widest border border-amber-400 shadow-xs transition-all disabled:opacity-50"
        >
          {saving ? 'Saving Broadcast...' : 'Save Broadcast Stream'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-3.5 rounded-xl border border-stone-300 bg-white text-stone-700 hover:text-stone-950 font-bold text-xs uppercase tracking-wider transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
