import { ReactNode, Suspense } from 'react';
import PageLoading from '@/components/PageLoading';

// The page reads the team id with useParams(), which is only known at request
// time. With Cache Components enabled, that needs a Suspense boundary.
export default function TeamLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<PageLoading label="Loading team..." />}>
      {children}
    </Suspense>
  );
}
