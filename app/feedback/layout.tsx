import { Suspense } from 'react';

// The page reads ?tournament= with useSearchParams(), which is only known at
// request time. With Cache Components enabled, that needs a Suspense boundary.
export default function FeedbackLayout({ children }: LayoutProps<'/feedback'>) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-sitebg" />}>
      {children}
    </Suspense>
  );
}
