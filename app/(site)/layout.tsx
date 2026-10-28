import type { ReactNode } from 'react';
import SiteNavLayout from '@/components/site/SiteNavLayout';

// Public website layout:
// Includes the collapsible sidebar navigation separated by a clean vertical line,
// allowing the main content to adjust smoothly when collapsed or expanded.
export default function SiteLayout({ children }: { children: ReactNode }) {
  return <SiteNavLayout>{children}</SiteNavLayout>;
}
