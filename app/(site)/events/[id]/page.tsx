import { Suspense } from 'react';
import { PostDetail } from '@/components/site/Posts';

// One event. The id comes from the URL (only known at request time), so it's inside Suspense.
export default function EventPage({ params }: PageProps<'/events/[id]'>) {
  return (
    <Suspense fallback={<p className="text-gray-500">Loading...</p>}>
      <EventDetail params={params} />
    </Suspense>
  );
}

async function EventDetail({ params }: { params: PageProps<'/events/[id]'>['params'] }) {
  const { id } = await params;
  return <PostDetail table="events" id={id} backLabel="All events" />;
}
