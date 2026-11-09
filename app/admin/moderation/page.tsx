'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import ReportedComments from './ReportedComments';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import { usePageTitle } from '@/utils/page-title';
import { can } from '@/utils/permissions';
import { formatDateTime } from '@/utils/tournaments';
import { offenseLabels, WARNING_LIMIT, type OffenseType } from '@/utils/moderation-rules';
import PageLoading from '@/components/PageLoading';
import PageError from '@/components/PageError';
import PageHeroBackground from '@/components/site/PageHeroBackground';
import ConfirmDialog from '@/components/ConfirmDialog';
import { toast } from '@/components/Toaster';
import Avatar from '@/components/Avatar';
import SectionHint from '@/components/SectionHint';

type Tab = 'queue' | 'reported' | 'bans' | 'users';

interface HiddenComment {
  id: string;
  content: string;
  created_at: string;
  offense_type: string;
  moderation_reason: string | null;
  streams: { title: string; tournament_id: string } | null;
  author: { full_name: string | null; avatar_url: string | null } | null;
}

interface HiddenFeedback {
  id: string;
  comment: string;
  rating: number;
  created_at: string;
  offense_type: string;
  moderation_reason: string | null;
  tournaments: { name: string } | null;
}

interface WarningRow {
  id: string;
  user_id: string;
  source: string;
  type: string;
  reason: string;
  created_at: string;
  removed_at: string | null;
  removal_reason: string | null;
  issued_by: string | null;
}

interface ModUser {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
  avatar_url: string | null;
  ban_status: string;
  ban_flagged_at: string | null;
  banned_at: string | null;
  ban_reason: string | null;
}

// A pending confirmation: what it says, whether a reason is required, and what it runs
interface PendingAction {
  title: string;
  body: string;
  confirmLabel: string;
  danger: boolean;
  reasonLabel: string;
  reasonRequired: boolean;
  checkbox?: string;
  run: (note: string, checked: boolean) => Promise<unknown>;
}

// Moderation (Phase 4). Staff: the queue of comments the AI hid (restore / remove). Admins also:
// hidden feedback, accounts waiting for a ban decision, flagged users and their warnings, bans.
// Every action runs through a database function that checks the role again and writes the
// activity log.
export default function ModerationPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Moderation />
    </Suspense>
  );
}

function Moderation() {
  usePageTitle('Moderation');
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [comments, setComments] = useState<HiddenComment[]>([]);
  const [feedback, setFeedback] = useState<HiddenFeedback[]>([]);
  const [pendingBans, setPendingBans] = useState<ModUser[]>([]);
  const [flagged, setFlagged] = useState<(ModUser & { active: number })[]>([]);
  const [history, setHistory] = useState<Record<string, WarningRow[]>>({});
  const [openUser, setOpenUser] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const [action, setAction] = useState<PendingAction | null>(null);
  const [note, setNote] = useState('');
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [reloadCount, setReloadCount] = useState(0);
  // Hidden comments ticked for a bulk Restore / Remove
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const isAdmin = can(role, 'moderation.ban');
  const tabParam = searchParams.get('tab');
  // Reported comments: admins and staff; pending bans and flagged users: admins only
  const tab: Tab = tabParam === 'reported' ? 'reported' : isAdmin && (tabParam === 'bans' || tabParam === 'users') ? tabParam : 'queue';
  const reload = useCallback(() => setReloadCount((n) => n + 1), []);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: myRole, error: roleError } = await supabase.rpc('get_my_role');
        if (roleError) throw roleError;
        setRole(myRole ?? '');
        if (!can(myRole, 'moderation.review')) return;
        const admin = can(myRole, 'moderation.ban');

        const [commentsRes, pendingRes] = await Promise.all([
          supabase
            .from('stream_comments')
            .select('id, content, created_at, offense_type, moderation_reason, streams(title, tournament_id), author:profiles!stream_comments_user_id_fkey(full_name, avatar_url)')
            .eq('moderation_status', 'hidden')
            .order('created_at', { ascending: false })
            .limit(100),
          supabase.from('stream_comments').select('id', { count: 'exact', head: true }).eq('moderation_status', 'pending'),
        ]);
        if (commentsRes.error) throw commentsRes.error;
        setComments((commentsRes.data ?? []) as unknown as HiddenComment[]);
        let pending = pendingRes.count ?? 0;

        if (admin) {
          const [feedbackRes, bansRes, warningsRes, bannedRes, feedbackPending] = await Promise.all([
            supabase
              .from('feedback')
              .select('id, comment, rating, created_at, offense_type, moderation_reason, tournaments(name)')
              .eq('moderation_status', 'hidden')
              .order('created_at', { ascending: false })
              .limit(100),
            supabase
              .from('profiles')
              .select('id, full_name, email, role, avatar_url, ban_status, ban_flagged_at, banned_at, ban_reason')
              .eq('ban_status', 'pending')
              .order('ban_flagged_at'),
            supabase.from('user_warnings').select('user_id').is('removed_at', null).limit(1000),
            supabase
              .from('profiles')
              .select('id, full_name, email, role, avatar_url, ban_status, ban_flagged_at, banned_at, ban_reason')
              .eq('ban_status', 'banned'),
            supabase.from('feedback').select('id', { count: 'exact', head: true }).is('sentiment', null),
          ]);
          for (const r of [feedbackRes, bansRes, warningsRes, bannedRes]) if (r.error) throw r.error;
          setFeedback((feedbackRes.data ?? []) as unknown as HiddenFeedback[]);
          setPendingBans((bansRes.data ?? []) as ModUser[]);
          pending += feedbackPending.count ?? 0;

          // Flagged users = anyone with active warnings, plus banned accounts
          const counts = new Map<string, number>();
          for (const w of warningsRes.data ?? []) counts.set(w.user_id, (counts.get(w.user_id) ?? 0) + 1);
          const ids = [...counts.keys()];
          const warnedRes = ids.length
            ? await supabase
                .from('profiles')
                .select('id, full_name, email, role, avatar_url, ban_status, ban_flagged_at, banned_at, ban_reason')
                .in('id', ids)
            : { data: [] as ModUser[], error: null };
          if (warnedRes.error) throw warnedRes.error;
          const byId = new Map<string, ModUser>();
          for (const u of [...(warnedRes.data ?? []), ...(bannedRes.data ?? [])] as ModUser[]) byId.set(u.id, u);
          setFlagged(
            [...byId.values()]
              .map((u) => ({ ...u, active: counts.get(u.id) ?? 0 }))
              .sort((a, b) => b.active - a.active),
          );
        }
        setPendingCount(pending);
        setError('');
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to load the moderation queue'));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [supabase, reloadCount]);

  const loadHistory = async (userId: string) => {
    setOpenUser((current) => (current === userId ? null : userId));
    const { data, error: loadError } = await supabase
      .from('user_warnings')
      .select('id, user_id, source, type, reason, created_at, removed_at, removal_reason, issued_by')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (loadError) setError(getErrorMessage(loadError, 'Could not load the warning history.'));
    else setHistory((h) => ({ ...h, [userId]: (data ?? []) as WarningRow[] }));
  };

  const ask = (a: PendingAction) => {
    setNote('');
    setChecked(false);
    setActionError('');
    setAction(a);
  };

  const confirmAction = async () => {
    if (!action) return;
    setBusy(true);
    setActionError('');
    try {
      await action.run(note.trim(), checked);
      toast.success(`${action.confirmLabel}: done.`);
      setAction(null);
      setSelected(new Set());
      setHistory({});
      reload();
    } catch (err) {
      setActionError(getErrorMessage(err, 'That did not work.'));
    } finally {
      setBusy(false);
    }
  };

  // Bulk: the same function once per ticked comment. Stops at the first refusal (the dialog shows
  // it); the ones already done stay done and disappear after the reload.
  const bulkComments = (mode: 'restore' | 'remove') => {
    const ids = comments.filter((c) => selected.has(c.id)).map((c) => c.id);
    ask({
      title: mode === 'restore' ? `Restore ${ids.length} comments?` : `Confirm removing ${ids.length} comments?`,
      body: mode === 'restore'
        ? 'They become visible again and the warnings the AI gave for them are removed. The authors are told.'
        : 'They stay hidden for good. The warnings stay.',
      confirmLabel: mode === 'restore' ? 'Restore selected' : 'Remove selected',
      danger: mode === 'remove',
      reasonLabel: 'Note for all of them (optional)',
      reasonRequired: false,
      run: async (n) => {
        for (const id of ids) {
          await rpc(supabase.rpc('moderate_comment', { p_comment_id: id, p_action: mode, p_note: n }));
        }
      },
    });
  };

  // Each moderator action is one database function; it throws our readable message on refusal
  const rpc = async (fn: PromiseLike<{ error: unknown }>) => {
    const { error: rpcError } = await fn;
    if (rpcError) throw rpcError;
  };

  const retry = async () => {
    setRetrying(true);
    setMessage('');
    try {
      const res = await fetch('/api/moderation/retry', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessage(
        `Analysed ${data.analyzed} item(s). ${data.remaining} still waiting.${data.reason ? ` ${data.reason}` : ''}`,
      );
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The retry failed.');
    } finally {
      setRetrying(false);
    }
  };

  if (loading) return <PageLoading />;
  if (!role && error) return <PageError message={error} />;
  if (!can(role, 'moderation.review')) {
    return (
      <div className="w-full p-10 text-center space-y-4">
        <p className="font-extrabold text-stone-900">Only moderators can open this page.</p>
        <Link href="/dashboard" className="inline-block font-bold text-maroon underline">← Back to Dashboard</Link>
      </div>
    );
  }

  const tabClass = (t: Tab) =>
    `px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer ${
      tab === t ? 'bg-gold text-stone-950 shadow-xs' : 'text-stone-700 hover:bg-stone-100'
    }`;
  const setTab = (t: Tab) => router.replace(t === 'queue' ? '/admin/moderation' : `/admin/moderation?tab=${t}`, { scroll: false });
  const offense = (t: string) => offenseLabels[t as OffenseType] ?? t;

  return (
    <div className="w-full space-y-6 text-stone-950">
      <section className="relative w-full rounded-3xl border border-stone-800/80 bg-stone-950 overflow-hidden shadow-md p-8 sm:p-12 text-center text-white space-y-3">
        <PageHeroBackground specificKey="hero_banner_path" alt="DALTA Esports Moderation Banner" />
        <h1 className="relative z-10 text-3xl sm:text-4xl font-black tracking-wider uppercase text-white">Moderation</h1>
        <p className="relative z-10 text-base sm:text-lg font-medium text-white">
          {isAdmin ? 'Hidden content, warnings and bans.' : 'Comments the AI hid: restore them or confirm the removal.'}
        </p>
      </section>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">{error}</div>}
      {message && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">{message}</div>}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div role="tablist" aria-label="Moderation" className="inline-flex flex-wrap gap-1 p-1 rounded-2xl border border-stone-200/90 bg-white shadow-2xs">
          <button role="tab" aria-selected={tab === 'queue'} onClick={() => setTab('queue')} className={tabClass('queue')}>
            Hidden content ({comments.length + feedback.length})
          </button>
          <button role="tab" aria-selected={tab === 'reported'} onClick={() => setTab('reported')} className={tabClass('reported')}>
            Reported
          </button>
          {isAdmin && (
            <>
              <button role="tab" aria-selected={tab === 'bans'} onClick={() => setTab('bans')} className={tabClass('bans')}>
                Pending bans ({pendingBans.length})
              </button>
              <button role="tab" aria-selected={tab === 'users'} onClick={() => setTab('users')} className={tabClass('users')}>
                Flagged users ({flagged.length})
              </button>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-stone-600">{pendingCount} waiting for analysis</span>
          <button
            type="button"
            onClick={retry}
            disabled={retrying}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-stone-300 bg-white text-xs font-black uppercase tracking-wider hover:bg-stone-50 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${retrying ? 'motion-safe:animate-spin' : ''}`} /> Retry pending analysis
          </button>
          <SectionHint side="left" text="New posts retry waiting items automatically. Use this when the site is quiet or after Gemini was unavailable." />
        </div>
      </div>

      {/* Comments people reported (the AI let them through) */}
      {tab === 'reported' && <ReportedComments onChanged={reload} />}

      {tab === 'queue' && (
        <div className="space-y-6">
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-black">Hidden comments</h2>
              {comments.length > 1 && (
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-stone-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selected.size === comments.length}
                      onChange={(e) => setSelected(e.target.checked ? new Set(comments.map((c) => c.id)) : new Set())}
                    />
                    Select all
                  </label>
                  {selected.size > 0 && (
                    <>
                      <button type="button" onClick={() => bulkComments('restore')} className="btn btn-secondary !py-2">
                        Restore selected ({selected.size})
                      </button>
                      <button type="button" onClick={() => bulkComments('remove')} className="btn btn-danger !py-2">
                        Remove selected ({selected.size})
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
            {comments.length === 0 ? (
              <p className="rounded-2xl border border-stone-200/90 bg-white p-6 text-center text-stone-600">Nothing to review.</p>
            ) : (
              <ul className="space-y-3">
                {comments.map((c) => (
                  <li key={c.id} className="rounded-2xl border border-stone-200/90 bg-white p-4 shadow-xs space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      {comments.length > 1 && (
                        <input
                          type="checkbox"
                          aria-label={`Select the comment by ${c.author?.full_name || 'unknown user'}`}
                          checked={selected.has(c.id)}
                          onChange={(e) => setSelected((cur) => {
                            const next = new Set(cur);
                            if (e.target.checked) next.add(c.id);
                            else next.delete(c.id);
                            return next;
                          })}
                        />
                      )}
                      <Avatar url={c.author?.avatar_url} name={c.author?.full_name} size="sm" />
                      <span className="font-black break-words">{c.author?.full_name || 'Unknown user'}</span>
                      <span className="text-stone-600">on {c.streams?.title ?? 'a stream'} · {formatDateTime(c.created_at)}</span>
                      <span className="rounded bg-red-100 px-2 py-0.5 text-[11px] font-black uppercase text-red-800">{offense(c.offense_type)}</span>
                    </div>
                    <blockquote className="rounded-xl bg-stone-50 border border-stone-200 p-3 text-sm break-words whitespace-pre-wrap">{c.content}</blockquote>
                    {c.moderation_reason && <p className="text-sm text-stone-600">AI: {c.moderation_reason}</p>}
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => ask({
                          title: 'Restore this comment?', body: 'It becomes visible again and the warning the AI gave for it is removed. The author is told.',
                          confirmLabel: 'Restore comment', danger: false, reasonLabel: 'Note (optional)', reasonRequired: false,
                          run: (n) => rpc(supabase.rpc('moderate_comment', { p_comment_id: c.id, p_action: 'restore', p_note: n })),
                        })}
                        className="px-4 py-2 rounded-xl border border-stone-300 bg-white text-xs font-black uppercase tracking-wider hover:bg-stone-50 cursor-pointer"
                      >
                        Restore
                      </button>
                      <button
                        type="button"
                        onClick={() => ask({
                          title: 'Confirm the removal?', body: 'The comment stays hidden for good. The warning stays.',
                          confirmLabel: 'Confirm removal', danger: true, reasonLabel: 'Note (optional)', reasonRequired: false,
                          run: (n) => rpc(supabase.rpc('moderate_comment', { p_comment_id: c.id, p_action: 'remove', p_note: n })),
                        })}
                        className="px-4 py-2 rounded-xl border border-red-300 text-red-700 hover:bg-red-50 text-xs font-black uppercase tracking-wider cursor-pointer"
                      >
                        Confirm removal
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {isAdmin && (
            <section className="space-y-3">
              <h2 className="text-lg font-black flex items-center gap-1.5">
                Hidden feedback <SectionHint text="Feedback stays anonymous here, like on the feedback page. Restoring it removes the warning the AI gave." />
              </h2>
              {feedback.length === 0 ? (
                <p className="rounded-2xl border border-stone-200/90 bg-white p-6 text-center text-stone-600">Nothing to review.</p>
              ) : (
                <ul className="space-y-3">
                  {feedback.map((f) => (
                    <li key={f.id} className="rounded-2xl border border-stone-200/90 bg-white p-4 shadow-xs space-y-2">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-black">{f.tournaments?.name ?? 'General feedback'}</span>
                        <span className="text-stone-600">{f.rating}/5 · {formatDateTime(f.created_at)}</span>
                        <span className="rounded bg-red-100 px-2 py-0.5 text-[11px] font-black uppercase text-red-800">{offense(f.offense_type)}</span>
                      </div>
                      <blockquote className="rounded-xl bg-stone-50 border border-stone-200 p-3 text-sm break-words whitespace-pre-wrap">{f.comment}</blockquote>
                      {f.moderation_reason && <p className="text-sm text-stone-600">AI: {f.moderation_reason}</p>}
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => ask({
                            title: 'Restore this feedback?', body: 'It counts as normal feedback again and its warning is removed.',
                            confirmLabel: 'Restore feedback', danger: false, reasonLabel: 'Note (optional)', reasonRequired: false,
                            run: (n) => rpc(supabase.rpc('moderate_feedback', { p_feedback_id: f.id, p_action: 'restore', p_note: n })),
                          })}
                          className="px-4 py-2 rounded-xl border border-stone-300 bg-white text-xs font-black uppercase tracking-wider hover:bg-stone-50 cursor-pointer"
                        >
                          Restore
                        </button>
                        <button
                          type="button"
                          onClick={() => ask({
                            title: 'Confirm the removal?', body: 'The feedback stays hidden. The warning stays.',
                            confirmLabel: 'Confirm removal', danger: true, reasonLabel: 'Note (optional)', reasonRequired: false,
                            run: (n) => rpc(supabase.rpc('moderate_feedback', { p_feedback_id: f.id, p_action: 'remove', p_note: n })),
                          })}
                          className="px-4 py-2 rounded-xl border border-red-300 text-red-700 hover:bg-red-50 text-xs font-black uppercase tracking-wider cursor-pointer"
                        >
                          Confirm removal
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      )}

      {tab === 'bans' && isAdmin && (
        <section className="space-y-3">
          {pendingBans.length === 0 ? (
            <p className="rounded-2xl border border-stone-200/90 bg-white p-6 text-center text-stone-600">No accounts waiting for a decision.</p>
          ) : (
            <ul className="space-y-3">
              {pendingBans.map((u) => (
                <UserCard
                  key={u.id}
                  user={u}
                  active={flagged.find((f) => f.id === u.id)?.active ?? WARNING_LIMIT}
                  open={openUser === u.id}
                  history={history[u.id]}
                  onToggle={() => loadHistory(u.id)}
                  onRemoveWarning={(w) => ask({
                    title: 'Remove this warning?', body: `"${w.reason}" no longer counts. The user is told.`,
                    confirmLabel: 'Remove warning', danger: false, reasonLabel: 'Reason (required)', reasonRequired: true,
                    run: (n) => rpc(supabase.rpc('remove_warning', { p_warning_id: w.id, p_reason: n })),
                  })}
                >
                  <button
                    type="button"
                    onClick={() => ask({
                      title: `Ban ${u.full_name || u.email}?`, body: 'They can no longer log in and see your reason.',
                      confirmLabel: 'Confirm ban', danger: true, reasonLabel: 'Reason (required, shown to the user)', reasonRequired: true,
                      run: (n) => rpc(supabase.rpc('ban_user', { p_user_id: u.id, p_reason: n })),
                    })}
                    className="px-4 py-2 rounded-xl bg-red-700 hover:bg-red-800 text-white text-xs font-black uppercase tracking-wider cursor-pointer"
                  >
                    Confirm ban
                  </button>
                  <button
                    type="button"
                    onClick={() => ask({
                      title: 'Dismiss the ban?', body: 'The account is cleared and all its active warnings are reset. The user is told.',
                      confirmLabel: 'Dismiss and reset', danger: false, reasonLabel: 'Note (optional)', reasonRequired: false,
                      run: (n) => rpc(supabase.rpc('dismiss_ban', { p_user_id: u.id, p_note: n })),
                    })}
                    className="px-4 py-2 rounded-xl border border-stone-300 bg-white text-xs font-black uppercase tracking-wider hover:bg-stone-50 cursor-pointer"
                  >
                    Dismiss and reset warnings
                  </button>
                </UserCard>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === 'users' && isAdmin && (
        <section className="space-y-3">
          {flagged.length === 0 ? (
            <p className="rounded-2xl border border-stone-200/90 bg-white p-6 text-center text-stone-600">No users with warnings.</p>
          ) : (
            <ul className="space-y-3">
              {flagged.map((u) => (
                <UserCard
                  key={u.id}
                  user={u}
                  active={u.active}
                  open={openUser === u.id}
                  history={history[u.id]}
                  onToggle={() => loadHistory(u.id)}
                  onRemoveWarning={(w) => ask({
                    title: 'Remove this warning?', body: `"${w.reason}" no longer counts. The user is told.`,
                    confirmLabel: 'Remove warning', danger: false, reasonLabel: 'Reason (required)', reasonRequired: true,
                    run: (n) => rpc(supabase.rpc('remove_warning', { p_warning_id: w.id, p_reason: n })),
                  })}
                >
                  {u.ban_status === 'banned' ? (
                    <button
                      type="button"
                      onClick={() => ask({
                        title: `Unban ${u.full_name || u.email}?`, body: 'They can log in again. Their active warnings are reset.',
                        confirmLabel: 'Unban', danger: false, reasonLabel: 'Note (optional)', reasonRequired: false,
                        run: (n) => rpc(supabase.rpc('unban_user', { p_user_id: u.id, p_note: n })),
                      })}
                      className="px-4 py-2 rounded-xl border border-stone-300 bg-white text-xs font-black uppercase tracking-wider hover:bg-stone-50 cursor-pointer"
                    >
                      Unban
                    </button>
                  ) : u.role !== 'admin' && (
                    <button
                      type="button"
                      onClick={() => ask({
                        title: `Ban ${u.full_name || u.email}?`, body: 'They can no longer log in and see your reason.',
                        confirmLabel: 'Ban account', danger: true, reasonLabel: 'Reason (required, shown to the user)', reasonRequired: true,
                        run: (n) => rpc(supabase.rpc('ban_user', { p_user_id: u.id, p_reason: n })),
                      })}
                      className="px-4 py-2 rounded-xl border border-red-300 text-red-700 hover:bg-red-50 text-xs font-black uppercase tracking-wider cursor-pointer"
                    >
                      Ban
                    </button>
                  )}
                </UserCard>
              ))}
            </ul>
          )}
        </section>
      )}

      {action && (
        <ConfirmDialog
          title={action.title}
          confirmLabel={action.confirmLabel}
          tone={action.danger ? 'danger' : 'normal'}
          busy={busy}
          confirmDisabled={action.reasonRequired && note.trim().length < 3}
          error={actionError}
          onConfirm={confirmAction}
          onClose={() => setAction(null)}
        >
          <p>{action.body}</p>
          <label className="block">
            <span className="text-xs font-black uppercase tracking-wider text-stone-700">{action.reasonLabel}</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={300}
              rows={2}
              className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-base sm:text-sm"
            />
          </label>
          {action.checkbox && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} /> {action.checkbox}
            </label>
          )}
          <p className="text-xs text-stone-600">Recorded in the activity log.</p>
        </ConfirmDialog>
      )}
    </div>
  );
}

function UserCard({
  user, active, open, history, onToggle, onRemoveWarning, children,
}: {
  user: ModUser;
  active: number;
  open: boolean;
  history?: WarningRow[];
  onToggle: () => void;
  onRemoveWarning: (w: WarningRow) => void;
  children: React.ReactNode;
}) {
  const status = user.ban_status === 'banned'
    ? { text: 'Banned', cls: 'bg-red-100 text-red-800' }
    : user.ban_status === 'pending'
      ? { text: 'Waiting for decision', cls: 'bg-yellow-100 text-yellow-800' }
      : { text: 'Active', cls: 'bg-stone-100 text-stone-700' };

  return (
    <li className="rounded-2xl border border-stone-200/90 bg-white p-4 shadow-xs space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar url={user.avatar_url} name={user.full_name || user.email} size="md" />
          <div className="min-w-0">
            <p className="font-black break-words">{user.full_name || 'No name'} <span className="font-semibold text-stone-600">· {user.role}</span></p>
            <p className="text-sm text-stone-600 break-all">{user.email}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-xs font-black ${status.cls}`}>{status.text}</span>
          <span className="rounded-full bg-yellow-50 px-2.5 py-1 text-xs font-black text-yellow-800">{active} of {WARNING_LIMIT} warnings</span>
        </div>
      </div>
      {user.ban_status === 'banned' && user.ban_reason && (
        <p className="text-sm text-stone-700 break-words">Ban reason: {user.ban_reason} {user.banned_at && `(${formatDateTime(user.banned_at)})`}</p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="px-4 py-2 rounded-xl border border-stone-300 bg-white text-xs font-black uppercase tracking-wider hover:bg-stone-50 cursor-pointer"
        >
          {open ? 'Hide history' : 'Warning history'}
        </button>
        {children}
      </div>
      {open && (
        history === undefined ? (
          <p className="text-sm text-stone-600">Loading...</p>
        ) : (
          <ul className="space-y-2">
            {history.map((w) => (
              <li key={w.id} className={`rounded-xl border p-3 text-sm ${w.removed_at ? 'border-stone-200 bg-stone-50 text-stone-600' : 'border-yellow-300 bg-yellow-50'}`}>
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-black">
                      {w.type === 'offensive' ? 'Offensive' : 'Profanity'} in a {w.source}
                      <span className="font-semibold text-stone-600"> · {formatDateTime(w.created_at)} · {w.issued_by ? 'by a moderator' : 'by the AI'}</span>
                    </p>
                    <p className="break-words">{w.reason}</p>
                    {w.removed_at && <p className="text-xs break-words">Removed: {w.removal_reason}</p>}
                  </div>
                  {!w.removed_at && (
                    <button
                      type="button"
                      onClick={() => onRemoveWarning(w)}
                      className="shrink-0 text-xs font-black uppercase tracking-wider text-maroon underline cursor-pointer"
                    >
                      Remove warning
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )
      )}
    </li>
  );
}
