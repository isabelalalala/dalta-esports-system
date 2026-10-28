// Full-page and section skeleton screen loaders matching DALTA Esports design system.
// role="status" and aria-busy="true" ensure screen readers announce loading properly.

interface PageLoadingProps {
  label?: string;
  variant?: 'grid' | 'detail' | 'dashboard';
}

export default function PageLoading({ label = 'Loading...', variant = 'grid' }: PageLoadingProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      className="w-full space-y-8 uppercase text-stone-950 pb-12 select-none"
    >
      {/* 1. Main Hero Container Skeleton */}
      <HeroSkeleton />

      {/* 2. Body Skeleton Variant */}
      {variant === 'detail' ? (
        <DetailBodySkeleton />
      ) : variant === 'dashboard' ? (
        <DashboardBodySkeleton />
      ) : (
        <GridBodySkeleton />
      )}
    </div>
  );
}

// Dark Hero Banner Skeleton matching official pages
export function HeroSkeleton() {
  return (
    <section className="relative w-full rounded-3xl border border-stone-800/80 bg-stone-950 p-8 sm:p-14 lg:p-16 text-center text-white flex flex-col items-center justify-center space-y-5 overflow-hidden shimmer-dark shadow-md">
      {/* Action / Back bar */}
      <div className="w-full flex items-center justify-between gap-4">
        <div className="h-4 w-28 sm:w-36 rounded-md bg-stone-800" />
        <div className="h-6 w-24 sm:w-32 rounded-full bg-stone-800" />
      </div>

      {/* Headline & Subtitle */}
      <div className="max-w-3xl mx-auto space-y-3.5 pt-2 flex flex-col items-center w-full">
        <div className="h-9 sm:h-12 w-3/4 sm:w-1/2 rounded-xl bg-stone-800" />
        <div className="h-4 w-5/6 sm:w-2/3 rounded-lg bg-stone-800/70" />
      </div>
    </section>
  );
}

// 3-Column Card Grid Skeleton (Matching Tournaments, Events, Campaigns, Divisions)
export function GridBodySkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 sm:gap-8 w-full">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col rounded-2xl border border-stone-200/90 bg-white shadow-xs overflow-hidden shimmer-light"
        >
          {/* Aspect-video media showcase skeleton */}
          <div className="relative aspect-video bg-stone-100 flex items-center justify-center border-b border-stone-100">
            <div className="w-16 h-16 rounded-2xl bg-stone-200/80" />
          </div>

          {/* Card Content Skeleton */}
          <div className="p-5 sm:p-6 space-y-4 flex-1 flex flex-col justify-between">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="h-3.5 w-24 rounded-md bg-stone-200" />
                <div className="h-5 w-20 rounded-full bg-stone-100" />
              </div>
              <div className="h-5 w-4/5 rounded-md bg-stone-200" />
              <div className="h-3.5 w-full rounded-md bg-stone-100" />
              <div className="h-3.5 w-2/3 rounded-md bg-stone-100" />
            </div>

            <div className="pt-3 border-t border-stone-100 flex items-center justify-between gap-3">
              <div className="h-3.5 w-28 rounded-md bg-stone-100" />
              <div className="h-4 w-16 rounded-md bg-stone-200" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Detail Page Showcase Skeleton (Matching tournament/[id], posts/[id])
export function DetailBodySkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start w-full">
      {/* Left Media Column */}
      <div className="lg:col-span-5 w-full">
        <div className="relative w-full aspect-[4/3] max-h-[380px] sm:max-h-[420px] rounded-3xl border border-stone-200/90 bg-stone-100 overflow-hidden shadow-xs shimmer-light flex items-center justify-center">
          <div className="w-24 h-24 rounded-3xl bg-stone-200/80" />
        </div>
      </div>

      {/* Right Content Column */}
      <div className="lg:col-span-7 space-y-6 w-full">
        <div className="rounded-3xl border border-stone-200/90 bg-white p-6 sm:p-8 shadow-xs space-y-5 shimmer-light">
          <div className="h-5 w-32 rounded-md bg-stone-200" />
          <div className="space-y-3">
            <div className="h-4 w-full rounded-md bg-stone-100" />
            <div className="h-4 w-5/6 rounded-md bg-stone-100" />
            <div className="h-4 w-4/5 rounded-md bg-stone-100" />
          </div>
          <div className="pt-4 border-t border-stone-100 grid grid-cols-2 gap-4">
            <div className="h-10 rounded-xl bg-stone-100" />
            <div className="h-10 rounded-xl bg-stone-100" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Dashboard Multi-Section Skeleton
export function DashboardBodySkeleton() {
  return (
    <div className="space-y-8 w-full">
      {/* Stats row skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-stone-200/90 bg-white p-5 space-y-2.5 shimmer-light shadow-xs"
          >
            <div className="h-3.5 w-20 rounded-md bg-stone-100" />
            <div className="h-7 w-14 rounded-lg bg-stone-200" />
          </div>
        ))}
      </div>

      {/* 2-Column Dashboard Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
        <div className="rounded-3xl border border-stone-200/90 bg-white p-6 sm:p-8 space-y-4 shimmer-light shadow-xs">
          <div className="h-5 w-36 rounded-md bg-stone-200" />
          <div className="space-y-3">
            <div className="h-16 rounded-2xl bg-stone-50 border border-stone-100" />
            <div className="h-16 rounded-2xl bg-stone-50 border border-stone-100" />
          </div>
        </div>
        <div className="rounded-3xl border border-stone-200/90 bg-white p-6 sm:p-8 space-y-4 shimmer-light shadow-xs">
          <div className="h-5 w-36 rounded-md bg-stone-200" />
          <div className="space-y-3">
            <div className="h-16 rounded-2xl bg-stone-50 border border-stone-100" />
            <div className="h-16 rounded-2xl bg-stone-50 border border-stone-100" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Small inline version for a section inside a page (replaces old pixel dots)
export function SectionLoading({ label = 'Loading...' }: { label?: string }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      className="w-full rounded-2xl border border-stone-200/80 bg-white p-5 sm:p-6 space-y-3.5 shimmer-light shadow-2xs select-none"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="h-4 w-32 rounded-md bg-stone-200" />
        <div className="h-5 w-16 rounded-full bg-stone-100" />
      </div>
      <div className="space-y-2">
        <div className="h-3.5 w-full rounded-md bg-stone-100" />
        <div className="h-3.5 w-4/5 rounded-md bg-stone-100" />
      </div>
    </div>
  );
}
