import { ReactNode, Suspense } from 'react';

// The profile page reads ?weak=1 (sent by the login page) with useSearchParams(), which
// is only known at request time. With Cache Components enabled, that needs a Suspense boundary.
export default function ProfileLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      {children}
    </Suspense>
  );
}
