'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import type { Match, Profile, Stream, StreamStatus, Tournament } from '@/utils/types';
import { roundLabel } from '@/utils/tournaments';
import { fetchTeamNames } from '@/utils/matches';
import { streamStatusStyles, validateFacebookUrl } from '@/utils/streams';
import FacebookPlayer from '@/components/FacebookPlayer';
import PageLoading from '@/components/PageLoading';
import PageError from '@/components/PageError';
import { usePageTitle } from '@/utils/page-title';
import PageHeroBackground from '@/components/site/PageHeroBackground';
import {
  AlertCircle,
  CircleCheck,
  Edit2,
  ExternalLink,
  Plus,
  Radio,
  Swords,
  Trash2,
  Tv,
  Video,
} from 'lucide-react';

const inputClass =
  'w-full border border-stone-300 bg-stone-50 px-4 py-3.5 text-stone-950 font-bold text-xs uppercase rounded-xl outline-none focus:border-amber-600 focus:bg-white focus:ring-2 focus:ring-amber-500/20 transition-all placeholder:text-stone-400 shadow-xs';
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

        setTournament(tournRes.data);
        setStreams(streamsRes.data || []);

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
    if (!confirm(`Delete stream "${stream.title}"?`)) return;
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

  if (profile?.role !== 'admin' && profile?.role !== 'staff') {
    return (
      <div className="w-full p-12 text-center text-xs font-black uppercase tracking-wider text-stone-600">
        Only organizers can configure streams.{' '}
        <Link href="/live" className="text-[#5B271E] underline hover:text-[#FFCC37]">Watch live streams</Link>
      </div>
    );
  }

  return (
    <div className="w-full space-y-8 uppercase text-stone-950">
      {/* 1. Main Hero Container */}
      <section className="relative w-full rounded-3xl border border-stone-800/80 bg-stone-950 overflow-hidden shadow-md p-8 sm:p-12 lg:p-14 text-center text-white flex flex-col items-center justify-center space-y-4">
        <PageHeroBackground specificKey="tournaments_hero_bg_path" alt="DALTA Esports Banner" />

        <div className="relative z-10 w-full flex flex-wrap items-center justify-between gap-4">
          <Link
            href={`/tournaments/${id}`}
            className="inline-flex items-center gap-1.5 text-xs font-black text-[#FFCC37] hover:text-[#FFE066] uppercase tracking-wider transition-colors"
          >
            ← Back to Tournament
          </Link>
          <span className="text-xs font-black text-stone-300 uppercase tracking-wider flex items-center gap-1.5">
            <Radio className="w-4 h-4 text-[#FFCC37]" /> Facebook Live Broadcast
          </span>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto space-y-3 pt-2">
          <h1
            className="text-3xl sm:text-4xl lg:text-5xl font-black !text-white text-white tracking-wider uppercase leading-tight"
            style={{ color: '#ffffff' }}
          >
            Manage Streams
          </h1>
          <p
            className="text-xs sm:text-sm text-stone-200 font-semibold uppercase tracking-wider leading-relaxed"
            style={{ color: '#ffffff' }}
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
        <div role="alert" className="rounded-2xl bg-red-500/10 border border-red-500/30 p-4 sm:p-5 text-red-700 text-xs sm:text-sm font-bold uppercase tracking-wider flex items-center gap-3">
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
          <span className="text-[11px] font-black tracking-widest text-[#5B271E] uppercase">Broadcast Roster</span>
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
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-[#5B271E] flex items-center justify-center">
            <Tv className="w-7 h-7" />
          </div>
          <p className="text-stone-900 text-sm font-black uppercase tracking-wider">
            No live streams configured for this tournament yet.
          </p>
          <p className="text-xs text-stone-500 font-semibold uppercase tracking-wider max-w-md">
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
              <div className="relative aspect-video w-full bg-black overflow-hidden border-b border-stone-100">
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
                        <Swords className="w-3.5 h-3.5 text-[#5B271E]" />
                        {matchLabels[stream.match_id] ?? 'Linked Match'}
                      </span>
                    )}
                  </div>

                  <h3 className="text-base sm:text-lg font-black text-stone-950 uppercase tracking-wide">
                    {stream.title}
                  </h3>

                  <p className="text-xs text-stone-400 font-mono truncate">
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const urlError = validateFacebookUrl(url);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (urlError) {
      setError(urlError);
      return;
    }
    setSaving(true);
    setError('');

    const fields = {
      title: title.trim(),
      facebook_url: url.trim(),
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
      className="rounded-3xl border border-amber-400/80 bg-white p-6 sm:p-8 lg:p-10 shadow-md space-y-6"
    >
      <div className="border-b border-stone-100 pb-3">
        <span className="text-[11px] font-black tracking-widest text-[#5B271E] uppercase">Broadcast Studio</span>
        <h2 className="text-xl sm:text-2xl font-black text-stone-950 uppercase tracking-wide flex items-center gap-2">
          <Video className="w-5 h-5 text-[#5B271E]" /> {existing ? 'Edit Broadcast Stream' : 'Configure New Live Stream'}
        </h2>
      </div>

      {error && (
        <div role="alert" className="rounded-2xl bg-red-500/10 border border-red-500/30 p-4 text-red-700 text-xs sm:text-sm font-bold uppercase tracking-wider flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      <div>
        <label className={labelClass}>
          Broadcast Title *
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Grand Finals: DALTA Valorant Cup"
          aria-label="Stream title"
          className={inputClass}
          required
        />
      </div>

      <div>
        <label className={labelClass}>
          Facebook Live Video URL *
        </label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.facebook.com/yourpage/videos/123..."
          aria-label="Facebook video URL"
          className={inputClass}
          required
        />
        {url && (
          <p role={urlError ? 'alert' : 'status'} className={`mt-2 text-xs font-bold uppercase tracking-wider ${urlError ? 'text-red-600' : 'text-emerald-700'}`}>
            {urlError || <span className="inline-flex items-center gap-1.5"><CircleCheck className="h-4 w-4" /> Valid Facebook link. Verified playable preview below.</span>}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>
            Linked Match (Bracket Fixture)
          </label>
          <select value={matchId} onChange={(e) => setMatchId(e.target.value)} className={inputClass} aria-label="Linked match">
            <option value="">Whole Tournament (No single match)</option>
            {Object.entries(matchLabels).map(([mid, label]) => (
              <option key={mid} value={mid}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>
            Broadcast Status
          </label>
          <select value={status} onChange={(e) => setStatus(e.target.value as StreamStatus)} className={inputClass} aria-label="Stream status">
            <option value="scheduled">Scheduled</option>
            <option value="live">Live Now (On Air)</option>
            <option value="ended">Ended (VOD / Replay)</option>
          </select>
        </div>
      </div>

      {/* Real-time Video Embed Preview */}
      {url && !urlError && (
        <div className="space-y-2 pt-2">
          <span className="text-[11px] font-black uppercase text-stone-500 tracking-wider">Live Embed Preview</span>
          <div className="rounded-2xl border border-stone-200 overflow-hidden bg-black shadow-md aspect-video">
            <FacebookPlayer url={url} title="Broadcast Preview" />
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-stone-100">
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-3.5 rounded-xl bg-gold hover:bg-golddark text-stone-950 font-black text-xs uppercase tracking-widest border border-amber-400 shadow-xs hover:-translate-y-0.5 transition-all disabled:opacity-50"
        >
          {saving ? 'Saving Broadcast...' : 'Save Broadcast Stream'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-3.5 rounded-xl border border-stone-200 bg-white text-stone-600 hover:text-stone-950 font-bold text-xs uppercase tracking-wider transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
