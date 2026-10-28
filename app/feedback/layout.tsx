import { Suspense, type ReactNode } from 'react';
import SiteNavLayout from '@/components/site/SiteNavLayout';
import PageLoading from '@/components/PageLoading';

// The page reads ?tournament= with useSearchParams(), which is only known at
// request time. With Cache Components enabled, that needs a Suspense boundary.
export default function FeedbackLayout({ children }: { children: ReactNode }) {
  return (
    <SiteNavLayout>
      <Suspense fallback={<PageLoading label="Loading feedback page..." />}>
        {children}
      </Suspense>
    </SiteNavLayout>
  );
}
