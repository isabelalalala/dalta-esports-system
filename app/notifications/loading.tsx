import PageLoading from '@/components/PageLoading';

// Shown inside the section's sidebar layout while the page loads
export default function NotificationsLoading() {
  return <PageLoading variant="detail" label="Loading notifications..." />;
}
