import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPost, getPosts } from '@/utils/site-data';
import { siteImageUrl } from '@/utils/site';
import { formatDate } from '@/utils/tournaments';
import PostCard from './PostCard';
import { EmptyNote, PageTitle, Paragraphs, SiteBox } from './SiteParts';

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
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
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

  return (
    <article className="space-y-6">
      <Link href={`/${table}`} className="text-sm text-gold hover:underline">← {backLabel}</Link>
      <PageTitle title={post.title} subtitle={post.event_date ? formatDate(post.event_date) : undefined} />
      {image && (
        <div className="relative aspect-video border-2 border-gold overflow-hidden shadow-[6px_6px_0_var(--color-brown)]">
          <Image src={image} alt="" fill unoptimized className="object-cover" />
        </div>
      )}
      <SiteBox className="space-y-4">
        <Paragraphs text={post.description} />
        <div className="flex flex-wrap gap-3">
          {post.tournament_id && (
            <Link href={`/t/${post.tournament_id}`}
              className="px-4 py-2 border-2 border-gold bg-gold text-sitebg font-bold text-sm shadow-[3px_3px_0_var(--color-brown)]">
              View tournament
            </Link>
          )}
          {post.link && (
            <a href={post.link} {...(externalLink ? { target: '_blank', rel: 'noreferrer' } : {})}
              className="px-4 py-2 border-2 border-gold text-gold font-bold text-sm hover:bg-gold/10">
              More info{externalLink ? ' ↗' : ''}
            </a>
          )}
        </div>
      </SiteBox>
    </article>
  );
}
