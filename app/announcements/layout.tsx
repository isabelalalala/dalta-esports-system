import type { ReactNode } from 'react';
import SiteNavLayout from '@/components/site/SiteNavLayout';

export default function AnnouncementsLayout({ children }: { children: ReactNode }) {
  return <SiteNavLayout>{children}</SiteNavLayout>;
}

