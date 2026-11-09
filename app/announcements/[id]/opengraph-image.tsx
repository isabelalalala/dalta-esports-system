import { createPublicClient } from '@/utils/supabase/public';
import { CATEGORY_INFO, categoryOf, excerptOf } from '@/utils/announcements';
import { formatMomentDate } from '@/utils/tournaments';
import { OG_SIZE, ogCard } from '@/utils/og-card';

// Preview image when /announcements/<id> is shared (Facebook, Messenger). Published posts only.
export const alt = 'DALTA Esports announcement';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data } = /^[0-9a-f-]{36}$/i.test(id)
    ? await createPublicClient().from('announcements').select('title, body, category, publish_at').eq('id', id).maybeSingle()
    : { data: null };
  if (!data) return ogCard({ eyebrow: 'Announcement', title: 'DALTA Esports news' });
  return ogCard({
    eyebrow: `${CATEGORY_INFO[categoryOf(data.category)].label} · Announcement`,
    title: data.title,
    subtitle: excerptOf(data.body, 110),
    footer: formatMomentDate(data.publish_at),
  });
}
