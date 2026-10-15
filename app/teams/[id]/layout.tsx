import { Suspense } from 'react';

// The page reads the team id with useParams(), which is only known at request
// time. With Cache Components enabled, that needs a Suspense boundary.
export default function TeamLayout({ children }: LayoutProps<'/teams/[id]'>) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a0c]" />}>
      {children}
    </Suspense>
  );
}
