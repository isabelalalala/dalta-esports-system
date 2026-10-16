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

const inputClass =
  'w-full border border-brownlight bg-sitebg px-4 py-3 text-white placeholder-gray-400 outline-none focus:border-gold';

// "Configure stream" (use case, Tournament Staff): Facebook Live links for one tournament
export default function ManageStreamsPage() {
  usePageTitle('Tournament streams');
  const supabase = createClient();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [streams, setStreams] = useState<Stream[]>([]);
  // Match id -> "Semifinals: Team A vs Team B", for the match dropdown and labels
  const [matchLabels, setMatchLabels] = useState<Record<string, string>>({});
  const [profile, setProfile] = useState<Pick<Profile, 'id' | 'role'> | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Increase this to make the effect below load everything again
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
          // Matches with both teams known, for linking a stream to one match
          supabase
            .from('matches')
            .select('*')
            .eq('tournament_id', id)
            .order('round')
            .order('match_number'),
        ]);
        if (tournRes.error) throw tournRes.error;
        setTournament(tournRes.data);
        if (streamsRes.error) throw streamsRes.error;
        setStreams(streamsRes.data || []);
        if (matchesRes.error) throw matchesRes.error;

        const matches = (matchesRes.data || []) as Match[];
        const names = await fetchTeamNames(supabase, matches);
        const roundCount = matches.reduce((max, m) => Math.max(max, m.round), 0);
        const labels: Record<string, string> = {};
        for (const m of matches) {
          if (!m.team_a_id || !m.team_b_id) continue;  // byes and undecided matches
          labels[m.id] = `${roundLabel(m.round, roundCount)} · Match ${m.match_number}: ${names[m.team_a_id]} vs ${names[m.team_b_id]}`;
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

  // Go live / End stream / back to scheduled
  const setStatus = async (stream: Stream, status: StreamStatus) => {
    setError('');
    try {
      const { data, error: updateError } = await supabase
        .from('streams')
        .update({ status })
        .eq('id', stream.id)
        .select('id');
      if (updateError) throw updateError;
      // RLS blocks silently (no error, no rows)
      if (!data || data.length === 0) throw new Error('Only admin and staff can change streams.');
      setReloadCount((n) => n + 1);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update the stream'));
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

  // Hiding the page is only for convenience; the database refuses changes from other roles.
  if (profile?.role !== 'admin' && profile?.role !== 'staff') {
    return (
      <main id="main-content" className="min-h-screen bg-sitebg text-white p-10 text-center">
        Only organizers can configure streams.{' '}
        <Link href="/live" className="text-gold underline">Watch live streams</Link>
      </main>
    );
  }

  return (
    <main id="main-content" className="min-h-screen bg-sitebg text-white px-4 py-10">
      <div className="max-w-4xl mx-auto">
        <Link href={`/tournaments/${id}`} className="inline-block text-gold hover:underline mb-6">
          ← Back to Tournament
        </Link>

        <div className="flex flex-wrap justify-between items-center gap-4 mb-2">
          <h1 className="font-pixel text-xl sm:text-2xl leading-relaxed text-gold">{tournament.name}</h1>
          {!showForm && (
            <button
              onClick={() => { setShowForm(true); setEditingId(null); }}
              className="bg-gold text-black px-6 py-2 font-bold hover:bg-golddark transition"
            >
              + Add stream
            </button>
          )}
        </div>
        <p className="text-gray-400 text-lg mb-8">Stream Configuration</p>

        {error && (
          <div role="alert" className="mb-6 bg-red-500/10 border border-red-500 text-red-300 px-4 py-3">{error}</div>
        )}

        {showForm && profile && (
          <StreamForm
            tournamentId={id}
            userId={profile.id}
            matchLabels={matchLabels}
            onSaved={afterSave}
            onCancel={() => setShowForm(false)}
          />
        )}

        {/* A failed load shows the error above, not "nothing here" */}
        {streams.length === 0 && error ? null : streams.length === 0 ? (
          <p className="text-gray-400 text-center py-12">No streams yet. Add the Facebook Live link of your broadcast.</p>
        ) : (
          <div className="space-y-4">
            {streams.map((stream) =>
              editingId === stream.id && profile ? (
                <StreamForm
                  key={stream.id}
                  existing={stream}
                  tournamentId={id}
                  userId={profile.id}
                  matchLabels={matchLabels}
                  onSaved={afterSave}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <div key={stream.id} className="bg-sitecard border border-brownlight p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-bold">{stream.title}</h2>
                    <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase ${streamStatusStyles[stream.status]}`}>
                      {stream.status === 'live' ? '● Live' : stream.status}
                    </span>
                  </div>
                  {stream.match_id && (
                    <p className="text-sm text-gray-400">{matchLabels[stream.match_id] ?? 'Linked match'}</p>
                  )}
                  <p className="text-sm text-gray-400 truncate">{stream.facebook_url}</p>

                  <div className="mt-3 flex flex-wrap gap-3 text-sm font-semibold">
                    {stream.status !== 'live' && (
                      <button onClick={() => setStatus(stream, 'live')} className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5">
                        ● Go live
                      </button>
                    )}
                    {stream.status === 'live' && (
                      <button onClick={() => setStatus(stream, 'ended')} className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1.5">
                        End stream
                      </button>
                    )}
                    <Link href={`/live/${stream.id}`} className="text-gold hover:underline py-1.5">Watch page</Link>
                    <button onClick={() => { setEditingId(stream.id); setShowForm(false); }} className="text-gold hover:underline">
                      Edit
                    </button>
                    <button onClick={() => handleDelete(stream)} className="text-red-400 hover:text-red-300">
                      Delete
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </main>
  );
}

// Add a stream, or edit `existing`. Shows the link check and a preview player.
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

  // "Live Stream Link Validated Status": checked as you type (the database checks it too)
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
    <form onSubmit={handleSubmit} className="mb-6 bg-sitecard border-2 border-gold shadow-[6px_6px_0_var(--color-brown)] p-6 space-y-4">
      <h2 className="text-xl font-bold">{existing ? 'Edit stream' : 'Add stream'}</h2>
      {error && <div role="alert" className="bg-red-500/10 border border-red-500 text-red-300 px-4 py-3">{error}</div>}

      <input
        type="text" value={title} onChange={(e) => setTitle(e.target.value)}
        placeholder="Title, e.g. Main Stage – Day 1" aria-label="Stream title" className={inputClass} required
      />

      <div>
        <input
          type="url" value={url} onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.facebook.com/yourpage/videos/123..." aria-label="Facebook video URL" className={inputClass} required
        />
        {url && (
          <p role={urlError ? 'alert' : 'status'} className={`mt-1 text-sm ${urlError ? 'text-red-300' : 'text-green-400'}`}>
            {urlError || '✓ Valid Facebook link. Check the preview below plays.'}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <select value={matchId} onChange={(e) => setMatchId(e.target.value)} className={inputClass} aria-label="Linked match">
          <option value="">Whole tournament (no single match)</option>
          {Object.entries(matchLabels).map(([mid, label]) => (
            <option key={mid} value={mid}>{label}</option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value as StreamStatus)} className={inputClass} aria-label="Stream status">
          <option value="scheduled">Scheduled</option>
          <option value="live">Live</option>
          <option value="ended">Ended (replay)</option>
        </select>
      </div>

      {/* Preview, so staff can see the video embeds before saving */}
      {url && !urlError && <FacebookPlayer url={url} title="Preview" />}

      <div className="flex gap-2">
        <button
          type="submit" disabled={saving}
          className="bg-gold text-black px-6 py-2 font-bold hover:bg-golddark transition disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save stream'}
        </button>
        <button type="button" onClick={onCancel} className="text-gray-400 px-6 py-2 hover:text-white transition">
          Cancel
        </button>
      </div>
    </form>
  );
}
