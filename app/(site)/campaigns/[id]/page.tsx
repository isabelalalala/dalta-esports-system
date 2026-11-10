import { Suspense } from 'react';
import { PostDetail } from '@/components/site/Posts';
import { SectionLoading } from '@/components/PageLoading';

import type { Metadata } from 'next';
import { getPost } from '@/utils/site-data';

// Tab title: the campaign's own title (the root template adds " – DALTA Esports")
export async function generateMetadata({ params }: PageProps<'/campaigns/[id]'>): Promise<Metadata> {
  const { id } = await params;
  const post = await getPost('campaigns', id).catch(() => null);
  // Link previews: the first 160 characters of its description
  return { title: post?.title ?? 'Campaign', description: post?.description?.slice(0, 160) || undefined };
}

// One campaign. The id comes from the URL (only known at request time), so it's inside Suspense.
export default function CampaignPage({ params }: PageProps<'/campaigns/[id]'>) {
  return (
    <Suspense fallback={<SectionLoading />}>
      <CampaignDetail params={params} />
    </Suspense>
  );
}

async function CampaignDetail({ params }: { params: PageProps<'/campaigns/[id]'>['params'] }) {
  const { id } = await params;
  return <PostDetail table="campaigns" id={id} backLabel="All campaigns" />;
}
