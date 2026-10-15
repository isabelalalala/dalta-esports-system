import { Suspense } from 'react';

// The login page reads ?confirmed=1 with useSearchParams(), which is only known at
// request time. With Cache Components enabled, that needs a Suspense boundary.
export default function LoginLayout({ children }: LayoutProps<'/auth/login'>) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a0c]" />}>
      {children}
    </Suspense>
  );
}
