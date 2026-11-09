import PageLoading from '@/components/PageLoading';

// Shown inside the section's sidebar layout while the page loads
export default function ReportsLoading() {
  return <PageLoading variant="dashboard" label="Loading reports..." />;
}
