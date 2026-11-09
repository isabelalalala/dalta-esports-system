'use client';

import { useCallback, useEffect, useState } from 'react';
import { Flag } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import { formatDateTime } from '@/utils/tournaments';
import Avatar from '@/components/Avatar';
import { SectionLoading } from '@/components/PageLoading';
import { useConfirm } from '@/components/useConfirm';
import { toast } from '@/components/Toaster';

interface ReportRow {
  id: string;
  comment_id: string;
  reason: string;
  note: string | null;
  created_at: string;
  stream_comments: {
    id: string;
    content: string;
    created_at: string;
    moderation_status: string;
    streams: { title: string } | null;
    author: { full_name: string | null; avatar_url: string | null } | null;
  } | null;
}

interface ReportedComment {
  comment: NonNullable<ReportRow['stream_comments']>;
  reports: ReportRow[];
}

const REASON_LABELS: Record<string, string> = {
  bullying: 'Bullying', harassment: 'Harassment', hate_speech: 'Hate speech', threat: 'Threat',
  sexual: 'Sexual content', spam: 'Spam', other: 'Other',
};

// "Reported" tab on /admin/moderation (admin/staff): chat comments people reported because the AI
// let them through (comment_reports, open ones only). Remove = moderate_comment (optionally with a
// warning), which also closes the reports; Keep = dismiss_comment_reports(). Both are logged.
export default function ReportedComments({ onChanged }: { onChanged?: () => void }) {
  const supabase = createClient();
  const [confirmDialog, ask] = useConfirm();
  const [items, setItems] = useState<ReportedComment[] | null>(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);
  const reload = useCallback(() => setReloadCount((n) => n + 1), []);

  useEffect(() => {
    supabase
      .from('comment_reports')
      .select('id, comment_id, reason, note, created_at, stream_comments(id, content, created_at, moderation_status, streams(title), author:profiles!stream_comments_user_id_fkey(full_name, avatar_url))')
      .is('resolved_at', null)
      .order('created_at', { ascending: true })
      .then(({ data, error: loadError }) => {
        if (loadError) {
          setError(getErrorMessage(loadError, 'Could not load the reported comments.'));
          setItems([]);
          return;
        }
        // One entry per comment, with all its open reports
        const byComment = new Map<string, ReportedComment>();
        for (const r of (data || []) as unknown as ReportRow[]) {
          if (!r.stream_comments) continue;
          const entry = byComment.get(r.comment_id) ?? { comment: r.stream_comments, reports: [] };
          entry.reports.push(r);
          byComment.set(r.comment_id, entry);
        }
        setItems([...byComment.values()].sort((a, b) => b.reports.length - a.reports.length));
        setError('');
      });
  }, [supabase, reloadCount]);

  const removeComment = async (item: ReportedComment, warn: boolean) => {
    if (!(await ask({
      title: warn ? 'Remove and warn?' : 'Remove this comment?',
      message: warn ? 'The comment disappears for everyone and the author gets a warning (they are told why).' : 'The comment disappears for everyone.',
      confirmLabel: warn ? 'Remove and warn' : 'Remove',
      tone: 'danger',
    }))) return;
    setBusyId(item.comment.id);
    const { error: rpcError } = await supabase.rpc('moderate_comment', {
      p_comment_id: item.comment.id, p_action: 'remove', p_note: `Reported: ${item.reports.map((r) => REASON_LABELS[r.reason] ?? r.reason).join(', ')}`, p_warn: warn,
    });
    setBusyId(null);
    if (rpcError) return toast.error(getErrorMessage(rpcError, 'The comment could not be removed.'));
    toast.success('Comment removed.');
    reload();
    onChanged?.();
  };

  const keep = async (item: ReportedComment) => {
    setBusyId(item.comment.id);
    const { error: rpcError } = await supabase.rpc('dismiss_comment_reports', { p_comment_id: item.comment.id });
    setBusyId(null);
    if (rpcError) return toast.error(getErrorMessage(rpcError, 'Could not dismiss the reports.'));
    toast.success('Reports dismissed. The comment stays.');
    reload();
    onChanged?.();
  };

  if (items === null) return <SectionLoading label="Loading reported comments..." />;

  return (
    <div className="space-y-4">
      {confirmDialog}
      {error && <p role="alert" className="text-sm font-bold text-red-700">{error}</p>}
      {items.length === 0 && !error ? (
        <p className="rounded-2xl border border-stone-200/80 bg-stone-50/70 p-6 text-center text-sm font-bold text-stone-600">
          No reported comments. Nice and quiet.
        </p>
      ) : (
        <ul className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(min(100%,22rem),1fr))]">
          {items.map((item) => (
            <li key={item.comment.id} className="rounded-2xl border border-stone-200/90 bg-white p-4 sm:p-5 shadow-xs space-y-3">
              <div className="flex items-start gap-3">
                <Avatar url={item.comment.author?.avatar_url} name={item.comment.author?.full_name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-stone-600">
                    <span className="font-black text-stone-950">{item.comment.author?.full_name || 'Unknown'}</span>
                    {' · '}{item.comment.streams?.title ?? 'Stream'} · {formatDateTime(item.comment.created_at)}
                  </p>
                  <p className="mt-1 text-sm text-stone-900 break-words whitespace-pre-wrap">{item.comment.content}</p>
                </div>
              </div>
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-900 space-y-1">
                <p className="flex items-center gap-1.5 font-black uppercase tracking-wider">
                  <Flag className="size-3.5" aria-hidden="true" /> {item.reports.length} {item.reports.length === 1 ? 'report' : 'reports'}
                </p>
                <ul className="space-y-0.5">
                  {item.reports.map((r) => (
                    <li key={r.id}>{REASON_LABELS[r.reason] ?? r.reason}{r.note ? `: “${r.note}”` : ''}</li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={busyId === item.comment.id} onClick={() => removeComment(item, false)} className="btn btn-danger">Remove</button>
                <button type="button" disabled={busyId === item.comment.id} onClick={() => removeComment(item, true)} className="btn btn-secondary">Remove + warn</button>
                <button type="button" disabled={busyId === item.comment.id} onClick={() => keep(item)} className="btn btn-secondary">Keep</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
