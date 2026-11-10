import type { ReactNode } from 'react';
import type { Metadata } from 'next';

// Server-rendered title and description for link previews (the page itself is a client component)
export const metadata: Metadata = {
  title: 'Security',
  description: 'How DALTA Esports protects your account and data.',
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
