'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { SitePost } from '@/utils/site';
import PostCard from './PostCard';

const PAGE_SIZE = 4;

interface PostSectionCarouselProps {
  title: string;
  moreHref: string;
  emptyText: string;
  posts: SitePost[];
  baseHref: string;
}

export default function PostSectionCarousel({
  title,
  moreHref,
  emptyText,
  posts,
  baseHref,
}: PostSectionCarouselProps) {
  const [pageIndex, setPageIndex] = useState(0);

  const totalPages = Math.ceil(posts.length / PAGE_SIZE) || 1;
  const safePageIndex = Math.min(pageIndex, totalPages - 1);
  const visiblePosts = posts.slice(
    safePageIndex * PAGE_SIZE,
    (safePageIndex + 1) * PAGE_SIZE
  );

  return (
    <section className="w-full space-y-6">
      {/* Section Header */}
      <div className="flex items-center justify-between gap-4 border-b border-stone-200/80 pb-3">
        <h2 className="font-black text-stone-950 text-xl sm:text-2xl uppercase tracking-wider">
          {title}
        </h2>
        {posts.length > 0 && (
          <Link
            href={moreHref}
            className="text-xs sm:text-sm font-extrabold text-[#5B271E] uppercase tracking-widest hover:text-[#FFCC37] transition-colors"
          >
            See all →
          </Link>
        )}
      </div>

      {/* Content Area */}
      {posts.length === 0 ? (
        <div className="w-full rounded-2xl border border-stone-200/80 bg-stone-50/70 p-8 sm:p-12 text-center flex flex-col items-center justify-center gap-2 shadow-xs">
          <p className="text-stone-800 font-extrabold text-sm uppercase tracking-wider">
            {emptyText}
          </p>
          <p className="text-stone-500 text-xs font-semibold uppercase tracking-wide">
            Check back soon for upcoming announcements
          </p>
        </div>
      ) : (
        <div className="relative w-full">
          {/* Left Arrow Button */}
          {totalPages > 1 && (
            <button
              type="button"
              onClick={() => setPageIndex((prev) => Math.max(0, prev - 1))}
              disabled={safePageIndex === 0}
              aria-label={`Previous ${title.toLowerCase()}`}
              className="absolute -left-3 sm:-left-5 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white border border-stone-200/90 text-stone-900 shadow-md hover:shadow-lg hover:bg-stone-50 hover:border-amber-500/60 hover:scale-105 active:scale-95 transition-all flex items-center justify-center disabled:opacity-0 disabled:pointer-events-none cursor-pointer"
            >
              <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
          )}

          {/* 4 Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6 w-full min-h-[280px]">
            {visiblePosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                href={`${baseHref}/${post.id}`}
              />
            ))}
          </div>

          {/* Right Arrow Button */}
          {totalPages > 1 && (
            <button
              type="button"
              onClick={() =>
                setPageIndex((prev) => Math.min(totalPages - 1, prev + 1))
              }
              disabled={safePageIndex >= totalPages - 1}
              aria-label={`Next ${title.toLowerCase()}`}
              className="absolute -right-3 sm:-right-5 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white border border-stone-200/90 text-stone-900 shadow-md hover:shadow-lg hover:bg-stone-50 hover:border-amber-500/60 hover:scale-105 active:scale-95 transition-all flex items-center justify-center disabled:opacity-0 disabled:pointer-events-none cursor-pointer"
            >
              <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
          )}
        </div>
      )}
    </section>
  );
}

