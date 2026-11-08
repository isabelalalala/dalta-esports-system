import type { ReactNode } from 'react';
import { Suspense } from 'react';
import SiteNavLayout from '@/components/site/SiteNavLayout';
import PageLoading from '@/components/PageLoading';

// Teams pages get the app navigation. Suspense: /teams reads ?tab= and ?recruiting= with
// useSearchParams(), and /teams/[id] reads its id with useParams() (Cache Components needs a boundary).
export default function TeamsLayout({ children }: { children: ReactNode }) {
  return (
    <SiteNavLayout>
      <Suspense fallback={<PageLoading />}>{children}</Suspense>
    </SiteNavLayout>
  );
}
