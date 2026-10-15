import { Suspense } from 'react';

// The match page reads the id with useParams(), which is only known at request time.
// With Cache Components enabled, that needs a Suspense boundary.
export default function MatchLayout({ children }: LayoutProps<'/matches/[id]'>) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-sitebg" />}>
      {children}
    </Suspense>
  );
}
