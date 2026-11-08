import type { ReactNode } from 'react';
import { Suspense } from 'react';
import SiteNavLayout from '@/components/site/SiteNavLayout';
import PageLoading from '@/components/PageLoading';

// The profile page gets the app navigation. Suspense: it reads ?weak=1 (sent by the login page)
// with useSearchParams(), which is only known at request time (Cache Components).
export default function ProfileLayout({ children }: { children: ReactNode }) {
  return (
    <SiteNavLayout>
      <Suspense fallback={<PageLoading />}>{children}</Suspense>
    </SiteNavLayout>
  );
}
