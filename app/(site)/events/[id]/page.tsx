import { Suspense } from 'react';
import { PostDetail } from '@/components/site/Posts';
import { SectionLoading } from '@/components/PageLoading';

import type { Metadata } from 'next';
import { getPost } from '@/utils/site-data';

// Tab title: the event's own title (the root template adds " – DALTA Esports")
export async function generateMetadata({ params }: PageProps<'/events/[id]'>): Promise<Metadata> {
  const { id } = await params;
  const post = await getPost('events', id).catch(() => null);
  // Link previews: the first 160 characters of its description
  return { title: post?.title ?? 'Event', description: post?.description?.slice(0, 160) || undefined };
}

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
