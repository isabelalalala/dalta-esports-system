import type { ReactNode } from 'react';
import type { Metadata } from 'next';

// Server-rendered title and description for link previews (the page itself is a client component)
export const metadata: Metadata = {
  title: 'Code of Conduct',
  description: 'How players and spectators must behave on DALTA Esports: comment rules, warnings and the ban policy.',
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
