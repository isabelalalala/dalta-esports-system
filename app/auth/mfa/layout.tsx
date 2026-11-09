import { ReactNode, Suspense } from 'react';

// The 2FA page reads ?next= with useSearchParams(), which is only known at request time. With Cache
// Components enabled, that needs a Suspense boundary.
export default function MfaLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen w-full bg-white" />}>
      {children}
    </Suspense>
  );
}
