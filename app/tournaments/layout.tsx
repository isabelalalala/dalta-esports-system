import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import SiteNavLayout from '@/components/site/SiteNavLayout';

// Server-rendered title for /tournaments (link previews, and Next's streamed <title> no longer
// replaces the one usePageTitle sets). Inner pages still set their own with usePageTitle.
export const metadata: Metadata = {
  title: 'Tournaments',
  description: 'DALTA Esports tournaments for MLBB, Valorant, Tekken 8, League of Legends and CODM: brackets, schedules and registration.',
};

export default function TournamentsLayout({ children }: { children: ReactNode }) {
  return <SiteNavLayout>{children}</SiteNavLayout>;
}

