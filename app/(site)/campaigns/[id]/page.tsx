import { Suspense } from 'react';
import { PostDetail } from '@/components/site/Posts';

// One campaign. The id comes from the URL (only known at request time), so it's inside Suspense.
export default function CampaignPage({ params }: PageProps<'/campaigns/[id]'>) {
  return (
    <Suspense fallback={<p className="text-gray-500">Loading...</p>}>
      <CampaignDetail params={params} />
    </Suspense>
  );
}

async function CampaignDetail({ params }: { params: PageProps<'/campaigns/[id]'>['params'] }) {
  const { id } = await params;
  return <PostDetail table="campaigns" id={id} backLabel="All campaigns" />;
}
