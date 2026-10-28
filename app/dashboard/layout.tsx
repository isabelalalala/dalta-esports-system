import type { ReactNode } from 'react';
import SiteNavLayout from '@/components/site/SiteNavLayout';

// Dashboard layout:
// Includes the collapsible sidebar navigation separated by a vertical line on the left side,
// allowing the dashboard content to adjust smoothly when collapsed or expanded.
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <SiteNavLayout>{children}</SiteNavLayout>;
}

