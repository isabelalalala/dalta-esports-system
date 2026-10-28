import type { ReactNode } from 'react';
import SiteNavLayout from '@/components/site/SiteNavLayout';

export default function TournamentsLayout({ children }: { children: ReactNode }) {
  return <SiteNavLayout>{children}</SiteNavLayout>;
}

