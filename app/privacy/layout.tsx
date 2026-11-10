import type { ReactNode } from 'react';
import type { Metadata } from 'next';

// Server-rendered title and description for link previews (the page itself is a client component)
export const metadata: Metadata = {
  title: 'Privacy Notice',
  description: 'How DALTA Esports collects, uses, shares and keeps your personal data under the Data Privacy Act of 2012 (RA 10173).',
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
