import { ReactNode, Suspense } from 'react';

export default function RegisterLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen w-full bg-white" />}>
      {children}
    </Suspense>
  );
}

