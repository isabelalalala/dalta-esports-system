import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPost, getPosts } from '@/utils/site-data';
import { siteImageUrl } from '@/utils/site';
import { formatDate } from '@/utils/tournaments';
import PostCard from './PostCard';
import { EmptyNote, PageTitle, Paragraphs, SiteBox } from './SiteParts';
import { Calendar, ExternalLink, Trophy } from 'lucide-react';
import PageHeroBackground from './PageHeroBackground';

// Campaigns and events share these: the list page and the detail page.
type PostTable = 'campaigns' | 'events';

export async function PostList({ table, title, subtitle }: { table: PostTable; title: string; subtitle: string }) {
  const posts = await getPosts(table);
  return (
    <div>
      <PageTitle title={title} subtitle={subtitle} />
      {posts.length === 0 ? (
        <EmptyNote>Nothing here yet. Check back soon!</EmptyNote>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
          {posts.map((p) => <PostCard key={p.id} post={p} href={`/${table}/${p.id}`} />)}
        </div>
      )}
    </div>
  );
}

export async function PostDetail({ table, id, backLabel }: { table: PostTable; id: string; backLabel: string }) {
  const post = await getPost(table, id);
  if (!post) notFound();
  const image = siteImageUrl(post.image_path);
  const externalLink = post.link?.startsWith('https://');
  const sectionLabel = table === 'campaigns' ? 'Campaigns' : 'Events';
  const categoryLabel = table === 'campaigns' ? 'Official Campaign Initiative' : 'Official Event';

  return (
    <article className="space-y-8 uppercase">
      {/* 1. Main Hero Container with Background Banner */}
      <section className="animate-hero-entrance relative w-full rounded-3xl border border-stone-800/80 bg-stone-950 overflow-hidden shadow-md p-8 sm:p-12 lg:p-14 text-center text-white flex flex-col items-center justify-center space-y-4">
        <PageHeroBackground
          specificKey={table === 'campaigns' ? 'campaigns_hero_bg_path' : 'events_hero_bg_path'}
          alt="DALTA Esports Banner"
        />

        <div className="relative z-10 w-full flex items-center justify-between flex-wrap gap-3">
          <Link
            href={`/${table}`}
            className="inline-flex items-center gap-1.5 text-xs font-black text-[#FFCC37] hover:text-[#FFE066] uppercase tracking-wider transition-colors"
          >
            ← {backLabel}
          </Link>

          {post.event_date && (
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-white/10 border border-white/20 text-stone-200 text-xs font-black tracking-wider backdrop-blur-xs shadow-2xs">
              <Calendar className="w-3.5 h-3.5 text-[#FFCC37]" />
              <span>{formatDate(post.event_date)}</span>
            </span>
          )}
        </div>

        <div className="relative z-10 max-w-4xl mx-auto space-y-3 pt-2">
          <h1
            className="animate-hero-title text-3xl sm:text-4xl lg:text-5xl font-black !text-white text-white tracking-wider uppercase leading-tight"
            style={{ color: '#ffffff' }}
          >
            {post.title}
          </h1>
        </div>
      </section>

      {/* 2. Structured Content Showcase: Constrained Media Card + Information Box */}
      <div className={`animate-stagger-1 grid grid-cols-1 ${image ? 'lg:grid-cols-12' : ''} gap-8 items-start`}>
        {/* Left Media Card: Sized Proportionately without Screen Dominance */}
        {image && (
          <div className="lg:col-span-5 w-full">
            <div className="relative w-full aspect-[4/3] max-h-[380px] sm:max-h-[420px] rounded-3xl border border-stone-200/90 bg-[#0e0c0b] overflow-hidden shadow-xs grid place-items-center">
              {/* Subtle ambient lighting behind graphic */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    'radial-gradient(circle at 85% 85%, rgba(164, 148, 140, 0.35) 0%, rgba(35, 30, 27, 0.7) 45%, #0e0c0b 100%)',
                }}
              />
              <div className="relative z-0 w-full h-full p-6 flex items-center justify-center">
                <div className="relative w-full h-full">
                  <Image
                    src={image}
                    alt={post.title}
                    fill
                    sizes="(max-width: 1024px) 100vw, 450px"
                    className="object-contain drop-shadow-[0_6px_20px_rgba(0,0,0,0.6)]"
                    priority
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Right Details Card: Description, Context & Actions */}
        <div className={image ? 'lg:col-span-7 w-full' : 'w-full max-w-4xl mx-auto'}>
          <div className="rounded-3xl border border-stone-200/90 bg-white p-6 sm:p-8 lg:p-10 shadow-xs space-y-6">
            <div className="border-b border-stone-100 pb-4 space-y-1">
              <span className="text-[11px] font-black tracking-widest text-[#5B271E] uppercase">
                {categoryLabel}
              </span>
              <h2 className="text-lg sm:text-xl font-black text-stone-950 uppercase tracking-wide">
                Overview &amp; Information
              </h2>
            </div>

            <div className="text-stone-800 text-xs sm:text-sm font-medium uppercase tracking-wide leading-relaxed">
              <Paragraphs text={post.description} />
            </div>

            {(post.tournament_id || post.link) && (
              <div className="flex flex-wrap items-center gap-3.5 pt-4 border-t border-stone-100">
                {post.tournament_id && (
                  <Link
                    href={`/t/${post.tournament_id}`}
                    className="px-6 py-3 rounded-xl bg-gold hover:bg-golddark text-stone-950 font-black text-xs uppercase tracking-widest border border-amber-400 shadow-xs hover:-translate-y-0.5 transition-all inline-flex items-center gap-2"
                  >
                    <Trophy className="w-4 h-4 text-stone-950" />
                    <span>View Tournament</span>
                  </Link>
                )}
                {post.link && (
                  <a
                    href={post.link}
                    {...(externalLink ? { target: '_blank', rel: 'noreferrer' } : {})}
                    className="px-6 py-3 rounded-xl border border-stone-300 hover:border-[#FFCC37] bg-white text-stone-950 hover:text-[#5B271E] font-black text-xs uppercase tracking-widest shadow-xs hover:-translate-y-0.5 transition-all inline-flex items-center gap-2"
                  >
                    <span>More Details</span>
                    {externalLink && <ExternalLink className="w-3.5 h-3.5 text-[#5B271E]" />}
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
