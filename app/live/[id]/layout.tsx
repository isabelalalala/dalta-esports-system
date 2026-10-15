import { Suspense } from 'react';

// The watch page reads the stream id with useParams(), which is only known at
// request time. With Cache Components enabled, that needs a Suspense boundary.
export default function WatchLayout({ children }: LayoutProps<'/live/[id]'>) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-sitebg" />}>
      {children}
    </Suspense>
  );
}
