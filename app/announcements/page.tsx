'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import type { Announcement, Tournament } from '@/utils/types';
import AnnouncementCard from '@/components/AnnouncementCard';
import PageLoading from '@/components/PageLoading';
import { usePageTitle } from '@/utils/page-title';
import { Pin } from 'lucide-react';
import PageHeroBackground from '@/components/site/PageHeroBackground';

const inputClass =
  'w-full p-3 rounded-xl bg-white text-stone-950 border border-stone-300 placeholder:text-stone-400 uppercase tracking-wide focus:border-amber-600 focus:ring-2 focus:ring-amber-500/20 shadow-xs outline-none transition-all font-medium text-xs sm:text-sm';

type TournamentOption = Pick<Tournament, 'id' | 'name'>;

export default function AnnouncementsPage() {
  const supabase = createClient();
  usePageTitle('Announcements');
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [tournaments, setTournaments] = useState<TournamentOption[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState('');
  const [filter, setFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        setUserId(session.user.id);

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();
        if (profileError) throw profileError;
        setIsAdmin(profileData?.role === 'admin');

        const [tourRes, annRes] = await Promise.all([
          supabase
            .from('tournaments')
            .select('id, name')
            .order('start_date', { ascending: false }),
          supabase
            .from('announcements')
            .select('*, tournaments(id, name)')
            .order('pinned', { ascending: false })
            .order('created_at', { ascending: false }),
        ]);
        if (tourRes.error) throw tourRes.error;
        if (annRes.error) throw annRes.error;

        setTournaments(tourRes.data || []);
        setAnnouncements(annRes.data || []);
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to load announcements'));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [supabase, reloadCount]);

  const afterSave = () => {
    setShowForm(false);
    setEditingId(null);
    setReloadCount((n) => n + 1);
  };

  const handleDelete = async (a: Announcement) => {
    if (!confirm(`Delete announcement "${a.title}"?`)) return;
    setError('');
    try {
      const { error: deleteError } = await supabase.from('announcements').delete().eq('id', a.id);
      if (deleteError) throw deleteError;
      setReloadCount((n) => n + 1);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to delete announcement'));
    }
  };

  if (loading) return <PageLoading />;

  const visible = announcements.filter((a) => {
    if (filter === 'all') return true;
    if (filter === 'general') return a.tournament_id === null;
    return a.tournament_id === filter;
  });

  return (
    <div className="w-full space-y-8 uppercase">
      {/* 1. Main Hero Container with Official Banner */}
      <section className="relative w-full rounded-3xl border border-stone-800/80 bg-stone-950 overflow-hidden shadow-md p-8 sm:p-14 lg:p-16 text-center text-white flex flex-col items-center justify-center space-y-4">
        <PageHeroBackground specificKey="hero_banner_path" alt="DALTA Esports Announcements Banner" />

        <div className="relative z-10 w-full flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-black text-amber-400 hover:text-amber-300 uppercase tracking-wider transition-colors"
          >
            ← Back to Dashboard
          </Link>
          {isAdmin && !showForm && (
            <button
              onClick={() => { setShowForm(true); setEditingId(null); }}
              className="bg-gold text-stone-950 px-5 py-2.5 rounded-xl font-black border border-amber-400 shadow-xs hover:bg-golddark hover:-translate-y-0.5 transition-all uppercase tracking-widest text-xs cursor-pointer"
            >
              + New Announcement
            </button>
          )}
        </div>

        <div className="relative z-10 max-w-4xl mx-auto space-y-3 pt-2">
          <h1
            className="text-4xl sm:text-5xl lg:text-6xl font-black !text-white text-white tracking-wider uppercase leading-tight"
            style={{ color: '#ffffff' }}
          >
            Announcements
          </h1>
          <p
            className="text-base sm:text-lg !text-white text-stone-200 font-medium uppercase tracking-wide leading-relaxed"
            style={{ color: '#ffffff' }}
          >
            Official bulletins, tournament schedules, operational updates, and news.
          </p>
        </div>
      </section>

      {/* 2. Controls & Announcements Feed */}
      <div className="space-y-6 text-stone-950">
        {error && (
          <div role="alert" className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 text-xs font-bold tracking-wider shadow-2xs">
            {error}
          </div>
        )}

        {isAdmin && showForm && (
          <AnnouncementForm
            tournaments={tournaments}
            userId={userId}
            onSaved={afterSave}
            onCancel={() => setShowForm(false)}
          />
        )}

        <div className="sm:w-80">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className={inputClass}
            aria-label="Filter announcements"
          >
            <option value="all">All Announcements</option>
            <option value="general">General Updates Only</option>
            {tournaments.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        {visible.length === 0 && error ? null : visible.length === 0 ? (
          <p className="text-stone-500 text-center py-12 font-bold tracking-wider">No announcements posted yet.</p>
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
                      <div className="flex items-center gap-3 text-xs font-black tracking-wider">
                        <button
                          onClick={() => { setEditingId(a.id); setShowForm(false); }}
                          className="text-amber-700 hover:text-amber-800 underline cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(a)}
                          className="text-red-600 hover:text-red-700 underline cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>
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
      if (existing) {
        const { error: updateError } = await supabase
          .from('announcements')
          .update(fields)
          .eq('id', existing.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('announcements')
          .insert([{ ...fields, author_id: userId }]);
        if (insertError) throw insertError;
      }
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save announcement'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-stone-200/90 rounded-2xl p-6 sm:p-8 shadow-xs space-y-5 text-stone-950"
    >
      <div className="flex items-center justify-between pb-2 border-b border-stone-100">
        <h2 className="text-lg font-black text-stone-950 tracking-wider">
          {existing ? 'Edit Announcement' : 'Post New Announcement'}
        </h2>
        <button
          type="button"
          onClick={onCancel}
          className="text-stone-500 hover:text-stone-800 text-xs font-bold cursor-pointer"
        >
          Cancel
        </button>
      </div>

      {error && (
        <div role="alert" className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 text-xs font-bold tracking-wider shadow-2xs">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-black text-stone-800 tracking-wider mb-1.5 uppercase">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Announcement headline"
            className={inputClass}
            required
          />
        </div>

        <div>
          <label className="block text-xs font-black text-stone-800 tracking-wider mb-1.5 uppercase">Content</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            placeholder="Detailed announcement text..."
            className={`${inputClass} font-normal`}
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
          <div>
            <label className="block text-xs font-black text-stone-800 tracking-wider mb-1.5 uppercase">Tournament (Optional)</label>
            <select
              value={tournamentId}
              onChange={(e) => setTournamentId(e.target.value)}
              className={inputClass}
            >
              <option value="">General (All Tournaments)</option>
              {tournaments.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div className="pt-5 sm:pt-6">
            <label className="flex items-center gap-2.5 text-xs font-black text-stone-800 tracking-wider uppercase cursor-pointer">
              <input
                type="checkbox"
                checked={pinned}
                onChange={(e) => setPinned(e.target.checked)}
                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500/20 border-stone-300"
              />
              <Pin className="h-4 w-4 text-amber-600" />
              <span>Pin to top of feed</span>
            </label>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-gold hover:bg-golddark text-stone-950 font-black px-6 py-2.5 text-xs tracking-widest border border-amber-400 shadow-xs hover:-translate-y-0.5 transition-all disabled:opacity-50 cursor-pointer"
        >
          {saving ? 'Saving...' : existing ? 'Save Changes' : 'Post Announcement'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-stone-300 hover:border-stone-400 bg-white text-stone-700 font-bold px-5 py-2.5 text-xs tracking-wider transition-all cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
