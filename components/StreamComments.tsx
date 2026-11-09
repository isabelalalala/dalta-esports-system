'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { MessageSquare, Send, Trash2 } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import { useViewer } from '@/utils/use-viewer';
import { useRealtimeRefresh } from '@/utils/use-realtime-refresh';
import { can } from '@/utils/permissions';
import { timeAgo } from '@/utils/notifications';
import { formatDateTime } from '@/utils/tournaments';
import Avatar from '@/components/Avatar';
import ConfirmDialog from '@/components/ConfirmDialog';
import SectionHint from '@/components/SectionHint';

interface Props {
  streamId: string;
  // Replays show full timestamps instead of "2 min ago"
  replay?: boolean;
  // Tailwind height class for the scrolling list
  heightClass?: string;
}

interface StreamComment {
  id: string;
  content: string;
  created_at: string;
  author_name: string;
  author_avatar: string | null;
  is_mine: boolean;
  is_profane: boolean;
  moderation_status: string;
}

const MAX_LENGTH = 300;
const COOLDOWN_MS = 3000;
const PAGE = 100;

// Comments under a stream, live and on replays (Phase 4). Everyone (also logged out) reads the
// visible comments through get_stream_comments(); logged-in users who aren't flagged or banned can
// post. New comments, and comments the AI hides, show up for everyone through Realtime (the
// stream_comment_activity signal). Moderators can remove a comment from here.
export default function StreamComments({ streamId, replay = false, heightClass = 'h-96' }: Props) {
  const supabase = createClient();
  const viewer = useViewer();
  const [comments, setComments] = useState<StreamComment[]>([]);
  const [hasOlder, setHasOlder] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState('');
  const [cooldown, setCooldown] = useState(false);
  const [removing, setRemoving] = useState<StreamComment | null>(null);
  const [removeNote, setRemoveNote] = useState('');
  const [warnOnRemove, setWarnOnRemove] = useState(false);
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const [reloadCount, setReloadCount] = useState(0);

  const reload = useCallback(() => setReloadCount((n) => n + 1), []);
  useRealtimeRefresh(`comments-${streamId}`, [{ table: 'stream_comment_activity', filter: `stream_id=eq.${streamId}` }], reload, 300);

  // Latest comments (oldest first on screen). Older pages the viewer loaded stay in the list.
  useEffect(() => {
    supabase
      .rpc('get_stream_comments', { p_stream_id: streamId, p_limit: PAGE })
      .then(({ data, error: loadError }) => {
        setLoading(false);
        if (loadError) {
          setError(getErrorMessage(loadError, 'Comments could not be loaded.'));
          return;
        }
        setError('');
        const latest = ([...(data ?? [])] as StreamComment[]).reverse();
        setComments((current) => {
          const oldestLatest = latest[0]?.created_at;
          const older = oldestLatest ? current.filter((c) => c.created_at < oldestLatest) : [];
          return [...older, ...latest];
        });
        setHasOlder((current) => current || (data?.length ?? 0) === PAGE);
      });
  }, [supabase, streamId, reloadCount]);

  // Keep the newest comment in view while the viewer is at the bottom
  useEffect(() => {
    const list = listRef.current;
    if (list && stickToBottom.current) list.scrollTop = list.scrollHeight;
  }, [comments]);

  const loadOlder = async () => {
    const oldest = comments[0]?.created_at;
    if (!oldest) return;
    const { data, error: loadError } = await supabase.rpc('get_stream_comments', {
      p_stream_id: streamId, p_limit: PAGE, p_before: oldest,
    });
    if (loadError) {
      setError(getErrorMessage(loadError, 'Older comments could not be loaded.'));
      return;
    }
    stickToBottom.current = false;
    setComments((current) => [...([...(data ?? [])] as StreamComment[]).reverse(), ...current]);
    setHasOlder((data?.length ?? 0) === PAGE);
  };

  const post = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = text.trim();
    if (!content || cooldown) return;
    setPosting(true);
    setPostError('');
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stream_id: streamId, content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Your comment could not be posted.');
      setText('');
      stickToBottom.current = true;
      reload();
      // Same limit as the database: one comment every 3 seconds
      setCooldown(true);
      window.setTimeout(() => setCooldown(false), COOLDOWN_MS);
    } catch (err) {
      setPostError(err instanceof Error ? err.message : 'Your comment could not be posted.');
    } finally {
      setPosting(false);
    }
  };

  const removeComment = async () => {
    if (!removing) return;
    setBusy(true);
    try {
      const { error: rpcError } = await supabase.rpc('moderate_comment', {
        p_comment_id: removing.id, p_action: 'remove', p_note: removeNote.trim(), p_warn: warnOnRemove,
      });
      if (rpcError) throw rpcError;
      setRemoving(null);
      reload();
    } catch (err) {
      setError(getErrorMessage(err, 'The comment could not be removed.'));
    } finally {
      setBusy(false);
    }
  };

  const isModerator = can(viewer.role, 'moderation.review');
  const remaining = MAX_LENGTH - text.length;

  return (
    <section className="flex flex-col rounded-2xl border border-stone-200/90 bg-white shadow-xs" aria-labelledby={`comments-${streamId}`}>
      <div className="flex items-center justify-between gap-2 border-b border-stone-100 px-4 py-3">
        <h2 id={`comments-${streamId}`} className="text-base font-black flex items-center gap-1.5">
          <MessageSquare className="h-4 w-4" aria-hidden="true" /> {replay ? 'Comments' : 'Live chat'}
          <SectionHint text="Be kind: comments are checked automatically. Swearing gets a warning; bullying, hate or threats are hidden. 5 warnings can get an account banned." />
        </h2>
        <span className="text-xs font-semibold text-stone-600">{comments.length}{hasOlder ? '+' : ''}</span>
      </div>

      {/* role="log" isn't allowed on a list, so the scrolling live region wraps the <ol> */}
      <div
        ref={listRef}
        role="log"
        aria-live="polite"
        aria-label="Comments"
        onScroll={(e) => {
          const el = e.currentTarget;
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        }}
        className={`${heightClass} overflow-y-auto px-4 py-3`}
      >
      <ol className="space-y-3">
        {hasOlder && (
          <li className="text-center">
            <button type="button" onClick={loadOlder} className="text-xs font-black uppercase tracking-wider text-maroon hover:underline cursor-pointer">
              Load older comments
            </button>
          </li>
        )}
        {loading && <li className="text-sm text-stone-600">Loading comments...</li>}
        {error && <li role="alert" className="text-sm font-bold text-red-700">{error}</li>}
        {!loading && !error && comments.length === 0 && (
          <li className="text-sm text-stone-600">No comments yet. Say hi!</li>
        )}
        {comments.map((c) => {
          const hidden = c.moderation_status === 'hidden';
          return (
            <li key={c.id} className={`flex gap-2.5 ${hidden ? 'rounded-xl border border-red-200 bg-red-50 p-2' : ''}`}>
              <Avatar url={c.author_avatar} name={c.author_name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-stone-600">
                  <span className="font-black text-stone-950">{c.author_name}{c.is_mine ? ' (you)' : ''}</span>
                  <time dateTime={c.created_at}>{replay ? formatDateTime(c.created_at) : timeAgo(c.created_at)}</time>
                  {c.is_profane && (
                    <span className="rounded bg-yellow-100 px-1.5 py-0.5 text-[10px] font-black uppercase text-yellow-800">Profanity</span>
                  )}
                  {c.is_mine && c.moderation_status === 'pending' && <span className="italic">checking...</span>}
                </p>
                <p className="text-sm leading-relaxed text-stone-900 break-words whitespace-pre-wrap">{c.content}</p>
                {hidden && (
                  <p className="mt-1 text-xs font-bold text-red-800">
                    Hidden: only you can see this. A moderator will review it.
                  </p>
                )}
              </div>
              {isModerator && !c.is_mine && (
                <button
                  type="button"
                  onClick={() => { setRemoveNote(''); setWarnOnRemove(false); setRemoving(c); }}
                  aria-label={`Remove comment by ${c.author_name}`}
                  className="self-start p-1 text-stone-500 hover:text-red-700 cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          );
        })}
      </ol>
      </div>

      <div className="border-t border-stone-100 p-3">
        {viewer.status !== 'ready' ? null : !viewer.userId ? (
          <p className="text-sm text-stone-700">
            <Link href="/auth/login" className="font-bold text-maroon underline">Log in</Link> to comment.
          </p>
        ) : viewer.banStatus !== 'none' ? (
          <p className="text-sm text-stone-700">
            Your account is flagged for review, so you can&apos;t comment right now.
          </p>
        ) : (
          <form onSubmit={post} className="space-y-1.5">
            <div className="flex gap-2">
              <label htmlFor={`comment-input-${streamId}`} className="sr-only">Write a comment</label>
              <textarea
                id={`comment-input-${streamId}`}
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, MAX_LENGTH))}
                onKeyDown={(e) => {
                  // Enter sends, Shift+Enter makes a new line
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    e.currentTarget.form?.requestSubmit();
                  }
                }}
                rows={2}
                maxLength={MAX_LENGTH}
                placeholder="Write a comment..."
                className="flex-1 min-w-0 resize-none rounded-xl border border-stone-300 bg-white px-3 py-2 text-base sm:text-sm text-stone-950 placeholder:text-stone-500 focus:border-gold focus:ring-2 focus:ring-gold/25 outline-none"
              />
              <button
                type="submit"
                disabled={posting || cooldown || !text.trim()}
                aria-label="Send comment"
                className="self-end h-10 w-10 shrink-0 rounded-xl bg-gold hover:bg-golddark text-stone-950 grid place-items-center disabled:opacity-50 cursor-pointer"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <div className="flex justify-between gap-2 text-xs text-stone-600">
              <span role={postError ? 'alert' : undefined} className={postError ? 'font-bold text-red-700' : ''}>
                {postError || (cooldown ? 'You can comment again in a moment.' : 'Be respectful.')}
              </span>
              <span className={remaining < 30 ? 'font-bold text-stone-950' : ''}>{remaining}</span>
            </div>
          </form>
        )}
      </div>

      {removing && (
        <ConfirmDialog
          title="Remove this comment?"
          confirmLabel="Remove comment"
          tone="danger"
          busy={busy}
          onConfirm={removeComment}
          onClose={() => setRemoving(null)}
        >
          <blockquote className="rounded-xl border border-stone-200 bg-stone-50 p-3 text-sm break-words">
            <span className="font-black">{removing.author_name}:</span> {removing.content}
          </blockquote>
          <p>It disappears for everyone. This is recorded in the activity log.</p>
          <label className="block">
            <span className="text-xs font-black uppercase tracking-wider text-stone-700">Note (optional)</span>
            <input
              value={removeNote}
              onChange={(e) => setRemoveNote(e.target.value)}
              maxLength={300}
              className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-base sm:text-sm"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={warnOnRemove} onChange={(e) => setWarnOnRemove(e.target.checked)} />
            Also give the author a warning (they are told why)
          </label>
        </ConfirmDialog>
      )}
    </section>
  );
}
