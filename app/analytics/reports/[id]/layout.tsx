import { Suspense } from 'react';

// The report page reads the id with useParams(), which is only known at request time.
// With Cache Components enabled, that needs a Suspense boundary.
export default function SavedReportLayout({ children }: LayoutProps<'/analytics/reports/[id]'>) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a0c]" />}>
      {children}
    </Suspense>
  );
}
