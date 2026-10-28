import type { ReactNode } from 'react';
import SiteNavLayout from '@/components/site/SiteNavLayout';

export default function LiveLayout({ children }: { children: ReactNode }) {
  return <SiteNavLayout>{children}</SiteNavLayout>;
}

