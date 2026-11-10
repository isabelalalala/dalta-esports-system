import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CalendarClock, Clock, FilePen, TriangleAlert } from 'lucide-react';
import { createClient } from '@/utils/supabase/server';
import { createPublicClient } from '@/utils/supabase/public';
import {
  excerptOf, isUrgent, readingMinutes, relatedAnnouncements, type FeedAnnouncement,
} from '@/utils/announcements';
import { loadLinks, loadReactions } from '@/utils/announcements-data';
import { formatDateTime } from '@/utils/tournaments';
import AnnouncementCover from '@/components/announcements/AnnouncementCover';
import AmbientBackground from '@/components/site/AmbientBackground';
import CategoryBadge from '@/components/announcements/CategoryBadge';
import AnnouncementBody from '@/components/announcements/AnnouncementBody';
import AnnouncementLinkCard from '@/components/announcements/AnnouncementLinkCard';
import AnnouncementReactions from '@/components/announcements/AnnouncementReactions';
import AnnouncementFeedCard from '@/components/announcements/AnnouncementFeedCard';
import { AuthorLine } from '@/components/announcements/AnnouncementMeta';
import { BackToFeed, EditAnnouncementLink, ReadTracker } from '@/components/announcements/AnnouncementClientBits';
import ShareButton from '@/components/ShareButton';
import { DetailBodySkeleton } from '@/components/PageLoading';
import GameBadge from '@/components/GameBadge';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Link previews only ever use what a logged-out visitor may read (no drafts)
export async function generateMetadata({ params }: PageProps<'/announcements/[id]'>): Promise<Metadata> {
  const { id } = await params;
  if (!UUID.test(id)) return { title: 'Announcement not found' };
  const { data } = await createPublicClient().from('announcements').select('title, body').eq('id', id).maybeSingle();
  if (!data) return { title: 'Announcement' };
  const description = excerptOf(data.body, 160);
  const path = `/announcements/${id}`;
  return {
    title: data.title,
    description,
    alternates: { canonical: path },
    openGraph: { title: data.title, description, url: path, type: 'article', siteName: 'DALTA Esports' },
    twitter: { card: 'summary_large_image', title: data.title, description },
  };
}

export default function AnnouncementPage({ params }: PageProps<'/announcements/[id]'>) {
  return (
    <Suspense fallback={<DetailBodySkeleton />}>
      <AnnouncementContent params={params} />
    </Suspense>
  );
}

async function AnnouncementContent({ params }: { params: PageProps<'/announcements/[id]'>['params'] }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  // The reader's own session: RLS shows drafts and scheduled posts to organizers only
  const supabase = await createClient();
  const { data } = await supabase.from('announcements').select('*').eq('id', id).maybeSingle();
  if (!data) notFound();
  const a = data as FeedAnnouncement;

  const [links, reactions, recentRes, gameRes] = await Promise.all([
    loadLinks(supabase, [a.id]),
    loadReactions(supabase, [a.id]),
    supabase.from('announcements').select('*').eq('is_draft', false).lte('publish_at', new Date().toISOString())
      .order('publish_at', { ascending: false }).limit(40),
    a.game_id ? supabase.from('games').select('name').eq('id', a.game_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const related = relatedAnnouncements(a, (recentRes.data ?? []) as FeedAnnouncement[], 3);
  const link = links[a.id];
  const gameName = gameRes.data?.name ?? null;
  const urgent = isUrgent(a);
  // Not sent yet and not a draft = waiting for its publish time (organizers only get such rows)
  const scheduled = !a.is_draft && a.notified_at === null;

  return (
    <div className="w-full space-y-8">
      <ReadTracker id={a.id} title={a.title} />

      {/* Large cover with the title on it */}
      <header className={`hero-pausable group relative isolate overflow-hidden rounded-3xl border bg-ink text-white shadow-md ${urgent ? 'border-red-500/70' : 'border-stone-800/80'}`}>
        {/* The same hero layers as PageHeroBackground (docs/brand.md "Motion"): slow Ken Burns zoom
            on the cover, the ambient glows + zigzag pattern, one light sweep. The cover itself stays
            (it also draws the category gradient + game logo when a post has no picture). */}
        <AnnouncementCover
          coverPath={a.cover_path} category={a.category} gameId={a.game_id} priority
          sizes="100vw" className="absolute inset-0 -z-10 hero-kenburns"
        />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-linear-to-t from-ink via-ink/80 to-ink/20" />
        <AmbientBackground onDark className="-z-10" />
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
          <div className="hero-sweep" />
        </div>
        {urgent && <span className="absolute inset-x-0 top-0 h-1.5 bg-red-600" aria-hidden="true" />}
        <div className="flex min-h-[20rem] @3xl:min-h-[26rem] flex-col justify-between gap-8 p-5 sm:p-8 @5xl:p-12">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <BackToFeed />
            <EditAnnouncementLink id={a.id} />
          </div>
          <div className="max-w-4xl space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <CategoryBadge category={a.category} />
              {a.game_id && (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-white backdrop-blur-sm">
                  <GameBadge game={a.game_id} name={gameName} size="xs" surface="dark" withName />
                </span>
              )}
              {a.is_draft && (
                <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-stone-950">
                  <FilePen className="size-3" aria-hidden="true" /> Draft: only organizers see this
                </span>
              )}
              {!a.is_draft && scheduled && (
                <span className="inline-flex items-center gap-1 rounded-md bg-yellow-300 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-stone-950">
                  <CalendarClock className="size-3" aria-hidden="true" /> Scheduled · {formatDateTime(a.publish_at)}
                </span>
              )}
            </div>
            <h1 className="text-3xl sm:text-4xl @5xl:text-5xl font-black leading-tight tracking-tight break-words text-white drop-shadow">
              {urgent && <TriangleAlert className="mr-2 inline size-8 -translate-y-1 text-red-400" aria-label="Urgent" />}
              {a.title}
            </h1>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <AuthorLine time={a.publish_at} tone="dark" />
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-300">
                <Clock className="size-3.5" aria-hidden="true" /> {readingMinutes(a.body)} min read
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="grid gap-8 @5xl:grid-cols-[minmax(0,1fr)_22rem]">
        <article className="min-w-0 space-y-8 rounded-3xl border border-stone-200/90 bg-white p-5 sm:p-8 shadow-xs">
          {urgent && (
            <div role="note" className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">
              <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              Important notice from the organizers. Please read it in full.
            </div>
          )}
          <AnnouncementBody body={a.body} title={a.title} />
          <div className="flex flex-col gap-4 border-t border-stone-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <AnnouncementReactions announcementId={a.id} initial={reactions[a.id]} />
            <div className="text-stone-700">
              <ShareButton path={`/announcements/${a.id}`} title={a.title} text={excerptOf(a.body, 120)} />
            </div>
          </div>
          {a.updated_at && new Date(a.updated_at).getTime() - new Date(a.publish_at).getTime() > 60_000 && !a.is_draft && (
            <p className="text-xs text-stone-600">Updated {formatDateTime(a.updated_at)}</p>
          )}
        </article>

        <aside className="space-y-6 @5xl:sticky @5xl:top-24 @5xl:self-start">
          {link && (
            <section className="space-y-3">
              <h2 className="text-xs font-black uppercase tracking-widest text-stone-700">Related</h2>
              <AnnouncementLinkCard link={link} />
            </section>
          )}
          {related.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-black uppercase tracking-widest text-stone-700">More announcements</h2>
              <div className="space-y-3">
                {related.map((r) => <AnnouncementFeedCard key={r.id} a={r} readIds={null} variant="row" />)}
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
