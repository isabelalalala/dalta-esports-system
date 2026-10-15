import { Suspense } from 'react';

// The pages under /tournaments/[id] read the id with useParams(), which is only
// known at request time. With Cache Components enabled, that needs a Suspense boundary.
export default function TournamentLayout({ children }: LayoutProps<'/tournaments/[id]'>) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a0c]" />}>
      {children}
    </Suspense>
  );
}
