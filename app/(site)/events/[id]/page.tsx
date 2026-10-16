import { Suspense } from 'react';
import { PostDetail } from '@/components/site/Posts';
import { SectionLoading } from '@/components/PageLoading';

// One event. The id comes from the URL (only known at request time), so it's inside Suspense.
export default function EventPage({ params }: PageProps<'/events/[id]'>) {
  return (
    <Suspense fallback={<SectionLoading />}>
      <EventDetail params={params} />
    </Suspense>
  );
}

async function EventDetail({ params }: { params: PageProps<'/events/[id]'>['params'] }) {
  const { id } = await params;
  return <PostDetail table="events" id={id} backLabel="All events" />;
}
