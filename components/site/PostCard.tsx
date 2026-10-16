import Image from 'next/image';
import Link from 'next/link';
import { formatDate } from '@/utils/tournaments';
import { siteImageUrl, type SitePost } from '@/utils/site';

// A campaign or event card (home page and the /campaigns and /events lists)
export default function PostCard({ post, href }: { post: SitePost; href: string }) {
  const image = siteImageUrl(post.image_path);

  return (
    <Link
      href={href}
      className="group flex flex-col border-2 border-brownlight bg-sitecard shadow-[4px_4px_0_var(--color-brown)] hover:border-gold transition-colors"
    >
      <div className="relative aspect-video border-b-2 border-brownlight bg-sitebg overflow-hidden">
        {image ? (
          <Image src={image} alt="" fill sizes="(max-width: 768px) 100vw, 400px" className="object-cover group-hover:scale-105 transition-transform" />
        ) : (
          <div className="absolute inset-0 grid place-items-center font-pixel text-[10px] text-brownlight">DALTA</div>
        )}
      </div>
      <div className="p-4 space-y-2 flex-1">
        {post.event_date && <p className="text-xs text-gold font-semibold">{formatDate(post.event_date)}</p>}
        <h3 className="font-bold text-white leading-snug group-hover:text-gold">{post.title}</h3>
        {post.description && <p className="text-sm text-gray-400 line-clamp-3">{post.description}</p>}
      </div>
    </Link>
  );
}
