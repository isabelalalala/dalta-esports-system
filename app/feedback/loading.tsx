import PageLoading from '@/components/PageLoading';

// Shown inside the section's sidebar layout while the page loads
export default function FeedbackLoading() {
  return <PageLoading variant="detail" label="Loading feedback page..." />;
}
