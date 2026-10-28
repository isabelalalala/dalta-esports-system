import type { ReactNode } from 'react';
import SiteNavLayout from '@/components/site/SiteNavLayout';

// Admin layout:
// Includes the collapsible sidebar navigation separated by a vertical line on the left side,
// providing seamless access across dashboard and management tools.
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <SiteNavLayout>{children}</SiteNavLayout>;
}

