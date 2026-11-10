import type { ReactNode } from 'react';
import type { Metadata } from 'next';

// Server-rendered title and description for link previews (the page itself is a client component)
export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'The rules for using DALTA Esports: accounts, tournaments, content and conduct.',
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
