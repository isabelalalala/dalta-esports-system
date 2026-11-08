import type { ReactNode } from 'react';
import { Suspense } from 'react';
import SiteNavLayout from '@/components/site/SiteNavLayout';
import PageLoading from '@/components/PageLoading';

// My Registrations gets the app navigation.
export default function RegistrationsLayout({ children }: { children: ReactNode }) {
  return (
    <SiteNavLayout>
      <Suspense fallback={<PageLoading />}>{children}</Suspense>
    </SiteNavLayout>
  );
}
