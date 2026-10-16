import { Suspense } from 'react';
import { PostDetail } from '@/components/site/Posts';
import { SectionLoading } from '@/components/PageLoading';

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
