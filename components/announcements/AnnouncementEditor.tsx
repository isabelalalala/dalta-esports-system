'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import {
  Bold, Eye, Film, Heading2, Heading3, ImagePlus, Italic, Link2, List, ListOrdered, Pin, Quote,
  TriangleAlert, Upload, X, FilePen, CalendarClock,
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useViewer } from '@/utils/use-viewer';
import { getErrorMessage } from '@/utils/errors';
import { checkSiteImage, deleteSiteImage, uploadSiteImage } from '@/utils/site-images';
import { siteImageUrl } from '@/utils/site';
import { fromDateTimeInput, toDateTimeInput, formatDateTime } from '@/utils/tournaments';
import {
  ANNOUNCEMENT_CATEGORIES, BODY_MAX, CATEGORY_INFO, LINKED_TYPES, TITLE_MAX, categoryOf, suggestedCategory,
  type AnnouncementCategory, type FeedAnnouncement, type LinkedType,
} from '@/utils/announcements';
import { refreshSite } from '@/app/admin/website/actions';
import { toast } from '@/components/Toaster';
import AnnouncementFeedCard from '@/components/announcements/AnnouncementFeedCard';
import AnnouncementBody from '@/components/announcements/AnnouncementBody';
import { CATEGORY_ICONS } from '@/components/announcements/CategoryBadge';

const inputClass =
  'w-full p-3 rounded-xl bg-white text-stone-950 border border-stone-300 placeholder:text-stone-500 focus:bg-surface focus:border-amber-600 focus:ring-2 focus:ring-amber-500/20 shadow-xs outline-none transition-all font-medium text-sm';
const labelClass = 'block text-xs font-black text-stone-800 tracking-wider mb-1.5 uppercase';

const LINK_LABELS: Record<LinkedType, string> = { tournament: 'Tournament', match: 'Match', stream: 'Stream', event: 'Event' };

interface Option { id: string; label: string; finished?: boolean }

// Admin editor for an announcement: cover, category, game, linked tournament/match/stream/event,
// pin, urgent, draft, publish later, a formatting toolbar for the body, and a live preview of the
// card (and of the full post). Saving is checked again by RLS (admins only) and by the
// database triggers (max 3 pinned, linked row exists).
export default function AnnouncementEditor({
  existing, games, tournaments, onSaved, onCancel,
}: {
  existing?: FeedAnnouncement;
  games: { id: string; name: string }[];
  tournaments: { id: string; name: string }[];
  onSaved: (id: string) => void;
  onCancel: () => void;
}) {
  const supabase = createClient();
  const viewer = useViewer();
  const [title, setTitle] = useState(existing?.title ?? '');
  const [body, setBody] = useState(existing?.body ?? '');
  const [category, setCategory] = useState<AnnouncementCategory>(categoryOf(existing?.category));
  const [gameId, setGameId] = useState(existing?.game_id ?? '');
  const [tournamentId, setTournamentId] = useState(existing?.tournament_id ?? '');
  const [linkedType, setLinkedType] = useState<LinkedType | ''>((existing?.linked_type as LinkedType) ?? '');
  const [linkedId, setLinkedId] = useState(existing?.linked_id ?? '');
  const [options, setOptions] = useState<Option[]>([]);
  const [pinned, setPinned] = useState(existing?.pinned ?? false);
  const [urgent, setUrgent] = useState(existing?.is_urgent ?? false);
  const [draft, setDraft] = useState(existing?.is_draft ?? false);
  const [publishAt, setPublishAt] = useState(() =>
    existing?.publish_at && new Date(existing.publish_at).getTime() > Date.now() ? toDateTimeInput(existing.publish_at) : '');
  // Cover: the saved path, a new file waiting to be uploaded, or removed
  const [coverPath, setCoverPath] = useState<string | null>(existing?.cover_path ?? null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [showPost, setShowPost] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState('');
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);

  // Options for the link picker, loaded when the kind changes (admins can read all of these)
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!linkedType) { setOptions([]); return; }
      let next: Option[] = [];
      if (linkedType === 'tournament') {
        next = tournaments.map((t) => ({ id: t.id, label: t.name }));
      } else if (linkedType === 'match') {
        const { data } = await supabase
          .from('matches')
          .select('id, round, match_number, status, scheduled_at, tournaments(name), team_a:teams!matches_team_a_id_fkey(name), team_b:teams!matches_team_b_id_fkey(name)')
          .not('team_a_id', 'is', null).not('team_b_id', 'is', null)
          .order('scheduled_at', { ascending: false, nullsFirst: false })
          .limit(150);
        next = (data ?? []).map((m) => ({
          id: m.id,
          finished: m.status === 'completed',
          label: `${m.team_a?.name ?? 'TBD'} vs ${m.team_b?.name ?? 'TBD'} · ${m.tournaments?.name ?? ''} R${m.round}${m.scheduled_at ? ` · ${formatDateTime(m.scheduled_at)}` : ''}`,
        }));
      } else if (linkedType === 'stream') {
        const { data } = await supabase.from('streams').select('id, title, status, tournaments(name)').order('created_at', { ascending: false }).limit(100);
        next = (data ?? []).map((s) => ({ id: s.id, label: `${s.title} · ${s.tournaments?.name ?? ''} (${s.status})` }));
      } else {
        const { data } = await supabase.from('events').select('id, title, event_date, is_published').order('event_date', { ascending: false, nullsFirst: false }).limit(100);
        next = (data ?? []).map((e) => ({ id: e.id, label: `${e.title}${e.event_date ? ` · ${e.event_date.slice(0, 10)}` : ''}${e.is_published ? '' : ' (not published: hidden from viewers)'}` }));
      }
      if (!cancelled) setOptions(next);
    };
    load();
    return () => { cancelled = true; };
  }, [linkedType, supabase, tournaments]);

  // Local preview address of a picked cover (freed when replaced, removed or the editor closes)
  const previewRef = useRef<string | null>(null);
  const setPreviewFile = (file: File | null) => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = file ? URL.createObjectURL(file) : null;
    setCoverFile(file);
    setCoverPreview(previewRef.current);
  };
  useEffect(() => () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
  }, []);

  const pickLink = (id: string) => {
    setLinkedId(id);
    // Suggest a category that fits the link, unless the admin already picked a specific one
    const suggestion = suggestedCategory(linkedType, options.find((o) => o.id === id)?.finished);
    if (id && suggestion && (category === 'general' || category === suggestedCategory(linkedType))) setCategory(suggestion);
  };

  // Toolbar: wraps the selection (bold/italic/link) or starts the selected lines with a marker
  const format = (kind: 'h2' | 'h3' | 'bold' | 'italic' | 'ul' | 'ol' | 'quote' | 'link' | 'video') => {
    const el = bodyRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = body.slice(start, end);
    let insert = selected;
    if (kind === 'bold') insert = `**${selected || 'bold text'}**`;
    else if (kind === 'italic') insert = `*${selected || 'italic text'}*`;
    else if (kind === 'link') {
      const href = window.prompt('Link address (https://… or a page like /t/…)');
      if (!href) return;
      insert = `[${selected || 'link text'}](${href.trim()})`;
    } else if (kind === 'video') {
      const href = window.prompt('Facebook video link');
      if (!href) return;
      insert = `\n\n${href.trim()}\n\n`;
    } else {
      const marker = { h2: '## ', h3: '### ', ul: '- ', ol: '1. ', quote: '> ' }[kind];
      const lines = (selected || (kind.startsWith('h') ? 'Heading' : 'Item')).split('\n');
      insert = lines.map((l, i) => (kind === 'ol' ? `${i + 1}. ` : marker) + l.replace(/^(#{2,3}|[-*>]|\d+[.)])\s+/, '')).join('\n');
      // Block markers belong at the start of a line
      if (start > 0 && body[start - 1] !== '\n') insert = `\n${insert}`;
    }
    const next = body.slice(0, start) + insert + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + insert.length, start + insert.length);
    });
  };

  // Images inside the post are uploaded right away (site-images/announcements/)
  const addImage = async (file: File | undefined) => {
    if (!file) return;
    const problem = checkSiteImage(file);
    if (problem) { setError(problem); return; }
    setUploadingImage(true);
    try {
      const path = await uploadSiteImage(supabase, file, 'announcements');
      const el = bodyRef.current;
      const at = el ? el.selectionStart : body.length;
      const alt = file.name.replace(/\.[^.]+$/, '').replace(/[[\]()]/g, '').slice(0, 80);
      const insert = `\n\n![${alt}](${siteImageUrl(path)})\n\n`;
      setBody(body.slice(0, at) + insert + body.slice(at));
    } catch (err) {
      setError(getErrorMessage(err, 'The image could not be uploaded.'));
    } finally {
      setUploadingImage(false);
      if (imageInput.current) imageInput.current.value = '';
    }
  };

  const pickCover = (file: File | undefined) => {
    if (!file) return;
    const problem = checkSiteImage(file);
    if (problem) { setError(problem); return; }
    setError('');
    setPreviewFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const scheduled = publishAt ? fromDateTimeInput(publishAt) : null;
    if (scheduled && new Date(scheduled).getTime() <= Date.now()) {
      setError('Pick a time in the future, or clear "Publish later" to publish now.');
      return;
    }
    if (linkedType && !linkedId) {
      setError(`Pick the ${LINK_LABELS[linkedType].toLowerCase()} to link, or choose "Nothing".`);
      return;
    }
    setSaving(true);
    let uploaded: string | null = null;
    try {
      if (coverFile) uploaded = await uploadSiteImage(supabase, coverFile, 'announcements');
      const newCover = coverFile ? uploaded : coverPath;
      const wasScheduled = existing?.publish_at && new Date(existing.publish_at).getTime() > Date.now();
      const fields = {
        title: title.trim(),
        body: body.trim(),
        category,
        game_id: gameId || null,
        tournament_id: tournamentId || null,
        linked_type: linkedType || null,
        linked_id: linkedType ? linkedId : null,
        pinned,
        is_urgent: urgent,
        is_draft: draft,
        cover_path: newCover,
        // Scheduled: hidden from players and spectators until then, notified at that time
        // (pg_cron). Clearing a schedule publishes it now.
        ...(scheduled ? { publish_at: scheduled } : wasScheduled ? { publish_at: new Date().toISOString() } : {}),
      };
      // .select() returns the saved row. If RLS blocked the change, nothing comes back.
      const { data, error: saveError } = existing
        ? await supabase.from('announcements').update(fields).eq('id', existing.id).select('id')
        : await supabase.from('announcements').insert([{ ...fields, created_by: viewer.userId }]).select('id');
      if (saveError) throw saveError;
      if (!data || data.length === 0) throw new Error('Only admins can post or edit announcements.');
      // The old cover file is no longer used
      if (existing?.cover_path && existing.cover_path !== newCover) await deleteSiteImage(supabase, existing.cover_path);
      // The homepage's "Latest news" is cached: show the change right away
      await refreshSite().catch(() => undefined);
      toast.success(draft ? 'Draft saved. Only organizers can see it.' : scheduled ? `Scheduled for ${formatDateTime(scheduled)}.` : existing ? 'Announcement updated.' : 'Announcement published.');
      onSaved(data[0].id);
    } catch (err) {
      if (uploaded) await deleteSiteImage(supabase, uploaded);
      setError(getErrorMessage(err, 'Failed to save the announcement'));
    } finally {
      setSaving(false);
    }
  };

  // What the card will look like (the preview uses the local image until it is uploaded)
  const previewRow: FeedAnnouncement = {
    id: existing?.id ?? 'preview',
    title: title.trim() || 'Your headline appears here',
    body: body.trim() || 'The first lines of the post become the excerpt on the card.',
    category, cover_path: coverFile ? null : coverPath, game_id: gameId || null, tournament_id: tournamentId || null,
    linked_type: linkedType || null, linked_id: linkedId || null, pinned, is_urgent: urgent, is_draft: draft,
    publish_at: existing?.publish_at ?? new Date(0).toISOString(), notified_at: null,
    created_at: existing?.created_at ?? '', updated_at: '', created_by: null,
  };
  const gameNames = Object.fromEntries(games.map((g) => [g.id, g.name]));
  const submitLabel = saving ? 'Saving…' : draft ? 'Save draft' : publishAt ? 'Schedule' : existing ? 'Save changes' : 'Publish now';

  const tool = 'grid size-9 place-items-center rounded-lg text-stone-700 hover:bg-gold/20 hover:text-stone-950 transition-colors cursor-pointer disabled:opacity-50';

  return (
    <form onSubmit={handleSubmit} className="rounded-3xl border border-stone-200/90 bg-white p-4 sm:p-6 shadow-xs space-y-6 text-stone-950">
      <div className="flex items-center justify-between gap-3 border-b border-stone-100 pb-3">
        <h2 className="text-lg font-black tracking-wider uppercase">{existing ? 'Edit announcement' : 'New announcement'}</h2>
        <button type="button" onClick={onCancel} className="grid size-10 place-items-center rounded-xl text-stone-600 hover:bg-stone-100 cursor-pointer" aria-label="Close the editor">
          <X className="size-5" />
        </button>
      </div>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">{error}</div>}

      <div className="grid gap-6 @5xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-5 min-w-0">
          <div>
            <label htmlFor="ann-title" className={labelClass}>Title</label>
            <input id="ann-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={TITLE_MAX} required className={inputClass} placeholder="e.g. MLBB Season 3 Grand Finals this Saturday" />
            <p className="mt-1 text-right text-xs text-stone-600">{title.length} / {TITLE_MAX}</p>
          </div>

          {/* Category chips with their colors and icons */}
          <fieldset>
            <legend className={labelClass}>Category</legend>
            <div className="flex flex-wrap gap-2">
              {ANNOUNCEMENT_CATEGORIES.map((c) => {
                const Icon = CATEGORY_ICONS[c];
                const on = category === c;
                return (
                  <label key={c} className={`inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl border px-3 text-xs font-black uppercase tracking-wider transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-gold ${on ? `${CATEGORY_INFO[c].badge} border-transparent` : 'border-stone-200 bg-surface text-stone-700 hover:border-gold'}`}>
                    <input type="radio" name="category" value={c} checked={on} onChange={() => setCategory(c)} className="sr-only" />
                    <Icon className="size-3.5" aria-hidden="true" /> {CATEGORY_INFO[c].label}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="grid gap-4 @3xl:grid-cols-2">
            <div>
              <label htmlFor="ann-game" className={labelClass}>Game (optional)</label>
              <select id="ann-game" value={gameId} onChange={(e) => setGameId(e.target.value)} className={inputClass}>
                <option value="">No specific game</option>
                {games.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="ann-tournament" className={labelClass}>Tournament (optional)</label>
              <select id="ann-tournament" value={tournamentId} onChange={(e) => setTournamentId(e.target.value)} className={inputClass}>
                <option value="">General: notify everyone</option>
                {tournaments.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <p className="mt-1 text-xs text-stone-600">With a tournament, only its registered teams are notified (everyone can still read it).</p>
            </div>
          </div>

          <div className="grid gap-4 @3xl:grid-cols-[12rem_minmax(0,1fr)]">
            <div>
              <label htmlFor="ann-link-type" className={labelClass}>Link card</label>
              <select id="ann-link-type" value={linkedType} onChange={(e) => { setLinkedType(e.target.value as LinkedType | ''); setLinkedId(''); }} className={inputClass}>
                <option value="">Nothing</option>
                {LINKED_TYPES.map((t) => <option key={t} value={t}>{LINK_LABELS[t]}</option>)}
              </select>
            </div>
            {linkedType && (
              <div className="min-w-0">
                <label htmlFor="ann-link" className={labelClass}>Which {LINK_LABELS[linkedType].toLowerCase()}</label>
                <select id="ann-link" value={linkedId} onChange={(e) => pickLink(e.target.value)} className={inputClass} required>
                  <option value="">Choose…</option>
                  {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
                <p className="mt-1 text-xs text-stone-600">Shown inside the post: live status, scores, countdown, and buttons like Watch or View Bracket.</p>
              </div>
            )}
          </div>

          {/* Cover image */}
          <div>
            <span className={labelClass}>Cover image (optional)</span>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <span className="relative block aspect-video w-full sm:w-56 shrink-0 overflow-hidden rounded-2xl border border-stone-200 bg-stone-100">
                {coverPreview || coverPath ? (
                  // eslint-disable-next-line @next/next/no-img-element -- a local blob: preview before upload
                  <img src={coverPreview ?? siteImageUrl(coverPath) ?? ''} alt="Cover preview" className="size-full object-cover" />
                ) : (
                  <span className="grid size-full place-items-center px-4 text-center text-xs font-semibold text-stone-600">No cover: the card uses the category colors and the game logo</span>
                )}
              </span>
              <div className="flex flex-wrap gap-2">
                <label className="btn btn-secondary cursor-pointer has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-gold">
                  <Upload className="size-4" aria-hidden="true" /> {coverPath || coverFile ? 'Replace' : 'Upload'}
                  <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" onChange={(e) => pickCover(e.target.files?.[0])} />
                </label>
                {(coverPath || coverFile) && (
                  <button type="button" className="btn btn-secondary" onClick={() => { setPreviewFile(null); setCoverPath(null); }}>
                    <X className="size-4" aria-hidden="true" /> Remove
                  </button>
                )}
                <p className="w-full text-xs text-stone-600">PNG, JPG, WebP or GIF, up to 5 MB. Wide images (16:9) look best.</p>
              </div>
            </div>
          </div>

          {/* Body with a small formatting toolbar */}
          <div>
            <label htmlFor="ann-body" className={labelClass}>Post</label>
            <div className="overflow-hidden rounded-xl border border-stone-300 focus-within:border-amber-600 focus-within:ring-2 focus-within:ring-amber-500/20">
              <div className="flex flex-wrap items-center gap-0.5 border-b border-stone-200 bg-stone-50 p-1" role="toolbar" aria-label="Formatting">
                <button type="button" className={tool} onClick={() => format('h2')} title="Heading" aria-label="Heading"><Heading2 className="size-4" /></button>
                <button type="button" className={tool} onClick={() => format('h3')} title="Small heading" aria-label="Small heading"><Heading3 className="size-4" /></button>
                <button type="button" className={tool} onClick={() => format('bold')} title="Bold" aria-label="Bold"><Bold className="size-4" /></button>
                <button type="button" className={tool} onClick={() => format('italic')} title="Italic" aria-label="Italic"><Italic className="size-4" /></button>
                <button type="button" className={tool} onClick={() => format('ul')} title="Bulleted list" aria-label="Bulleted list"><List className="size-4" /></button>
                <button type="button" className={tool} onClick={() => format('ol')} title="Numbered list" aria-label="Numbered list"><ListOrdered className="size-4" /></button>
                <button type="button" className={tool} onClick={() => format('quote')} title="Highlight box" aria-label="Highlight box"><Quote className="size-4" /></button>
                <button type="button" className={tool} onClick={() => format('link')} title="Link" aria-label="Link"><Link2 className="size-4" /></button>
                <button type="button" className={tool} onClick={() => imageInput.current?.click()} disabled={uploadingImage} title="Image" aria-label="Insert image"><ImagePlus className="size-4" /></button>
                <button type="button" className={tool} onClick={() => format('video')} title="Facebook video" aria-label="Insert Facebook video"><Film className="size-4" /></button>
                <input ref={imageInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" tabIndex={-1} onChange={(e) => addImage(e.target.files?.[0])} />
                {uploadingImage && <span className="px-2 text-xs font-bold text-stone-600">Uploading…</span>}
              </div>
              <textarea
                id="ann-body" ref={bodyRef} value={body} onChange={(e) => setBody(e.target.value)} rows={10} maxLength={BODY_MAX} required
                placeholder={'Write the announcement.\n\n## A heading\n- a list item\n**bold**, *italic*, [a link](https://…)'}
                className="block w-full resize-y bg-white p-3 font-mono text-sm text-stone-950 outline-none focus:bg-surface placeholder:text-stone-500"
              />
            </div>
            <p className="mt-1 text-xs text-stone-600">A Facebook video link on its own line becomes a player. Leave a blank line between paragraphs.</p>
          </div>

          {/* Options */}
          <div className="grid gap-3 @3xl:grid-cols-3">
            <Toggle checked={pinned} onChange={setPinned} icon={<Pin className="size-4 text-maroon" />} label="Pin (featured)" hint="Max 3, shown on top" />
            <Toggle checked={urgent} onChange={setUrgent} icon={<TriangleAlert className="size-4 text-red-600" />} label="Urgent" hint="Red style + site-wide banner" />
            <Toggle checked={draft} onChange={setDraft} icon={<FilePen className="size-4 text-stone-700" />} label="Draft" hint="Only organizers see it" />
          </div>
          <div className="@3xl:w-1/2">
            <label htmlFor="ann-publish-at" className={labelClass}><CalendarClock className="mr-1 inline size-4" aria-hidden="true" />Publish later (optional)</label>
            <input id="ann-publish-at" type="datetime-local" value={publishAt} onChange={(e) => setPublishAt(e.target.value)} className={inputClass} />
            <p className="mt-1 text-xs text-stone-600">Empty = publish now. Until then only organizers see it; everyone is notified at that time.</p>
          </div>
        </div>

        {/* Live card preview */}
        <aside className="space-y-3 @5xl:sticky @5xl:top-24 @5xl:self-start">
          <p className={labelClass}>Card preview</p>
          <div className="relative">
            <AnnouncementFeedCard a={previewRow} readIds={null} gameName={gameId ? gameNames[gameId] : null} />
            {coverPreview && (
              // The new cover isn't uploaded yet: lay the local file over the preview's cover area
              <span className="pointer-events-none absolute inset-x-0 top-0 block aspect-video overflow-hidden rounded-t-3xl">
                <Image src={coverPreview} alt="" fill unoptimized className="object-cover" />
              </span>
            )}
          </div>
          <button type="button" onClick={() => setShowPost((v) => !v)} className="btn btn-secondary w-full">
            <Eye className="size-4" aria-hidden="true" /> {showPost ? 'Hide post preview' : 'Preview the full post'}
          </button>
        </aside>
      </div>

      {showPost && (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-4 sm:p-6">
          <p className={labelClass}>Post preview</p>
          <h3 className="mb-4 text-2xl font-black tracking-tight break-words">{previewRow.title}</h3>
          <AnnouncementBody body={previewRow.body} title={previewRow.title} />
        </div>
      )}

      <div className="flex flex-col-reverse gap-3 border-t border-stone-100 pt-4 sm:flex-row sm:justify-end">
        <button type="button" onClick={onCancel} className="btn btn-secondary">Cancel</button>
        <button type="submit" disabled={saving || uploadingImage} className="btn btn-primary">{submitLabel}</button>
      </div>
    </form>
  );
}

function Toggle({ checked, onChange, icon, label, hint }: {
  checked: boolean; onChange: (v: boolean) => void; icon: React.ReactNode; label: string; hint: string;
}) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-gold ${checked ? 'border-gold bg-gold/10' : 'border-stone-200 hover:border-stone-300'}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-4 accent-amber-600" />
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-stone-950">{icon}{label}</span>
        <span className="block text-xs text-stone-600">{hint}</span>
      </span>
    </label>
  );
}
