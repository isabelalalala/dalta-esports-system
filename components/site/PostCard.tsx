import Image from 'next/image';
import Link from 'next/link';
import { formatDate } from '@/utils/tournaments';
import { siteImageUrl, type SitePost } from '@/utils/site';

// A campaign or event card (home page and the /campaigns and /events lists)
// Redesigned: Solid white background, uppercase Montserrat, high contrast.
export default function PostCard({ post, href }: { post: SitePost; href: string }) {
  const image = siteImageUrl(post.image_path);

  return (
    <Link
      href={href}
      className="group flex flex-col rounded-2xl border border-stone-200/90 bg-white shadow-xs hover:shadow-lg hover:-translate-y-1 hover:border-[#FFCC37]/60 transition-all duration-200 overflow-hidden"
    >
      <div className="relative aspect-video bg-stone-100 overflow-hidden border-b border-stone-100">
        {image ? (
          <Image src={image} alt="" fill sizes="(max-width: 768px) 100vw, 400px" className="object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="absolute inset-0 grid place-items-center font-black text-xs text-stone-400 uppercase tracking-widest">DALTA ESPORTS</div>
        )}
      </div>
      <div className="p-5 space-y-2 flex-1">
        {post.event_date && <p className="text-xs text-[#5B271E] font-extrabold uppercase tracking-wider">{formatDate(post.event_date)}</p>}
        <h3 className="font-black text-stone-950 text-base leading-snug uppercase tracking-wide group-hover:text-[#FFCC37] transition-colors">{post.title}</h3>
        {post.description && <p className="text-xs sm:text-sm text-stone-600 font-medium uppercase tracking-wide line-clamp-3">{post.description}</p>}
      </div>
    </Link>
  );
}
