'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import type { Announcement, Tournament } from '@/utils/types';
import AnnouncementCard from '@/components/AnnouncementCard';

const inputClass =
  'w-full rounded-lg border border-[#00d2ff]/40 bg-[#0a0a0c] px-4 py-3 text-white placeholder-gray-500 outline-none focus:border-[#00d2ff]';

type TournamentOption = Pick<Tournament, 'id' | 'name'>;

export default function AnnouncementsPage() {
  const supabase = createClient();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [tournaments, setTournaments] = useState<TournamentOption[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState('');
  // 'all', 'general', or a tournament id
  const [filter, setFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Increase this to make the effect below load everything again
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        setUserId(session.user.id);

        const { data: profileData } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();
        setIsAdmin(profileData?.role === 'admin');

        const { data: tournamentsData, error: tourError } = await supabase
          .from('tournaments')
          .select('id, name')
          .order('start_date', { ascending: false });
        if (tourError) throw tourError;
        setTournaments(tournamentsData || []);

        // Pinned first, then newest
        const { data, error: annError } = await supabase
          .from('announcements')
          .select('*, tournaments(id, name)')
          .order('pinned', { ascending: false })
          .order('created_at', { ascending: false });
        if (annError) throw annError;
        setAnnouncements(data || []);
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to load announcements'));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [supabase, reloadCount]);

  const handleDelete = async (a: Announcement) => {
    if (!confirm(`Delete the announcement "${a.title}"?`)) return;
    setError('');

    try {
      // RLS blocks silently (no error, no rows), so check that something was deleted
      const { data, error: deleteError } = await supabase
        .from('announcements')
        .delete()
        .eq('id', a.id)
        .select('id');
      if (deleteError) throw deleteError;
      if (!data || data.length === 0) throw new Error('Only administrators can delete announcements.');
      setAnnouncements((current) => current.filter((x) => x.id !== a.id));
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to delete announcement'));
    }
  };

  const afterSave = () => {
    setShowForm(false);
    setEditingId(null);
    setReloadCount((n) => n + 1);
  };

  if (loading) return <div className="min-h-screen bg-[#0a0a0c] text-white p-10 text-center">Loading...</div>;

  const visible = announcements.filter((a) => {
    if (filter === 'all') return true;
    if (filter === 'general') return a.tournament_id === null;
    return a.tournament_id === filter;
  });

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <Link href="/dashboard" className="inline-block text-[#00d2ff] hover:underline mb-6">
          ← Back to Dashboard
        </Link>

        <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
          <h1 className="text-4xl font-bold text-[#00d2ff]">Announcements</h1>
          {/* Admin only; the database refuses posts from other roles too */}
          {isAdmin && !showForm && (
            <button
              onClick={() => { setShowForm(true); setEditingId(null); }}
              className="bg-[#00d2ff] text-black px-6 py-2 rounded-lg font-bold hover:bg-[#00b8e6] transition"
            >
              + New announcement
            </button>
          )}
        </div>

        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500 text-red-300 px-4 py-3 rounded-lg">{error}</div>
        )}

        {isAdmin && showForm && (
          <AnnouncementForm
            tournaments={tournaments}
            userId={userId}
            onSaved={afterSave}
            onCancel={() => setShowForm(false)}
          />
        )}

        <select value={filter} onChange={(e) => setFilter(e.target.value)} className={`${inputClass} mb-6`}>
          <option value="all">All announcements</option>
          <option value="general">General only</option>
          {tournaments.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>

        {visible.length === 0 ? (
          <p className="text-gray-400 text-center py-12">No announcements yet.</p>
        ) : (
          <div className="space-y-4">
            {visible.map((a) =>
              editingId === a.id ? (
                <AnnouncementForm
                  key={a.id}
                  existing={a}
                  tournaments={tournaments}
                  userId={userId}
                  onSaved={afterSave}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <AnnouncementCard
                  key={a.id}
                  announcement={a}
                  actions={
                    isAdmin ? (
                      <>
                        <button onClick={() => { setEditingId(a.id); setShowForm(false); }} className="text-[#00d2ff] hover:underline">
                          Edit
                        </button>
                        <button onClick={() => handleDelete(a)} className="text-red-400 hover:text-red-300">
                          Delete
                        </button>
                      </>
                    ) : undefined
                  }
                />
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Create a new announcement, or edit `existing`.
function AnnouncementForm({
  existing,
  tournaments,
  userId,
  onSaved,
  onCancel,
}: {
  existing?: Announcement;
  tournaments: TournamentOption[];
  userId: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const supabase = createClient();
  const [title, setTitle] = useState(existing?.title ?? '');
  const [body, setBody] = useState(existing?.body ?? '');
  const [tournamentId, setTournamentId] = useState(existing?.tournament_id ?? '');
  const [pinned, setPinned] = useState(existing?.pinned ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    const fields = {
      title: title.trim(),
      body: body.trim(),
      tournament_id: tournamentId || null,
      pinned,
    };

    try {
      const { data, error: saveError } = existing
        ? await supabase.from('announcements').update(fields).eq('id', existing.id).select('id')
        : await supabase.from('announcements').insert([{ ...fields, created_by: userId }]).select('id');
      if (saveError) throw saveError;
      // RLS blocks updates silently (no error, no rows)
      if (!data || data.length === 0) throw new Error('Only administrators can post announcements.');
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save announcement'));
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mb-6 bg-[#1a1a2e] border border-[#00d2ff] rounded-xl p-6 space-y-4">
      <h2 className="text-xl font-bold">{existing ? 'Edit announcement' : 'New announcement'}</h2>
      {error && <div className="bg-red-500/10 border border-red-500 text-red-300 px-4 py-3 rounded-lg">{error}</div>}

      <input
        type="text" value={title} onChange={(e) => setTitle(e.target.value)}
        placeholder="Title" className={inputClass} required
      />
      <textarea
        value={body} onChange={(e) => setBody(e.target.value)}
        placeholder="What do you want to announce?" rows={6} className={inputClass} required
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
        <select value={tournamentId} onChange={(e) => setTournamentId(e.target.value)} className={inputClass}>
          <option value="">General (not for one tournament)</option>
          {tournaments.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
          <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
          📌 Pin to the top
        </label>
      </div>

      <div className="flex gap-2">
        <button
          type="submit" disabled={saving}
          className="bg-[#00d2ff] text-black px-6 py-2 rounded-lg font-bold hover:bg-[#00b8e6] transition disabled:opacity-50"
        >
          {saving ? 'Saving...' : existing ? 'Save changes' : 'Post'}
        </button>
        <button type="button" onClick={onCancel} className="text-gray-400 px-6 py-2 hover:text-white transition">
          Cancel
        </button>
      </div>
    </form>
  );
}
