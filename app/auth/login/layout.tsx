import { ReactNode, Suspense } from 'react';

// The login page reads ?confirmed=1 with useSearchParams(), which is only known at
// request time. With Cache Components enabled, that needs a Suspense boundary.
export default function LoginLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen w-full bg-white" />}>
      {children}
    </Suspense>
  );
}

