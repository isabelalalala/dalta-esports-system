import type { ReactNode } from 'react';
import type { Metadata } from 'next';

// Server-rendered title and description for link previews (the page itself is a client component)
export const metadata: Metadata = {
  title: 'Cookie Policy',
  description: 'The cookies DALTA Esports uses to keep you logged in and remember your settings.',
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
