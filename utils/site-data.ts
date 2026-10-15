// Cached reads for the PUBLIC website (server only). Everything is tagged 'site':
// saving on /admin/website refreshes it right away (updateTag in app/admin/website/actions.ts),
// and otherwise it refreshes about once a minute.
//
// Errors return empty content instead of failing, so the site still renders (e.g. during a
// build before the migration has run).
import { cacheLife, cacheTag } from 'next/cache';
import { createPublicClient } from '@/utils/supabase/public';
import {
  DEFAULT_SITE_CONTENT, type GameDivision, type HeroImage, type Officer, type OfficialTeam,
  type SiteContent, type SitePost,
} from '@/utils/site';

function cacheSite() {
  cacheLife('minutes');
  cacheTag('site');
}

export async function getSiteContent(): Promise<SiteContent> {
  'use cache';
  cacheSite();
  const { data, error } = await createPublicClient().from('site_content').select('key, value');
  if (error || !data) return DEFAULT_SITE_CONTENT;
  const content = { ...DEFAULT_SITE_CONTENT };
  for (const row of data) {
    // Keep the default for empty texts, except optional ones like social links and images
    if (row.key in content && (row.value || !DEFAULT_SITE_CONTENT[row.key as keyof SiteContent])) {
      content[row.key as keyof SiteContent] = row.value;
    }
  }
  return content;
}

export async function getHeroImages(): Promise<HeroImage[]> {
  'use cache';
  cacheSite();
  const { data } = await createPublicClient()
    .from('hero_images').select('*').order('display_order').order('created_at');
  return data ?? [];
}

// table: 'campaigns' or 'events'. Newest date first, then by display order.
export async function getPosts(table: 'campaigns' | 'events', limit?: number): Promise<SitePost[]> {
  'use cache';
  cacheSite();
  let query = createPublicClient()
    .from(table).select('*')
    .order('display_order')
    .order('event_date', { ascending: false, nullsFirst: false });
  if (limit) query = query.limit(limit);
  const { data } = await query;
  return data ?? [];
}

export async function getPost(table: 'campaigns' | 'events', id: string): Promise<SitePost | null> {
  'use cache';
  cacheSite();
  const { data } = await createPublicClient().from(table).select('*').eq('id', id).maybeSingle();
  return data;
}

export async function getDivisions(): Promise<GameDivision[]> {
  'use cache';
  cacheSite();
  const { data } = await createPublicClient()
    .from('game_divisions').select('*, games(name)').order('display_order');
  return data ?? [];
}

export async function getOfficers(): Promise<Officer[]> {
  'use cache';
  cacheSite();
  const { data } = await createPublicClient()
    .from('officers').select('*, games(name)').order('display_order').order('name');
  return data ?? [];
}

// Published official teams with their players (optionally for one game)
export async function getOfficialTeams(gameId?: string): Promise<OfficialTeam[]> {
  'use cache';
  cacheSite();
  let query = createPublicClient()
    .from('official_teams')
    .select('*, games(name), official_team_players(*)')
    .order('display_order')
    .order('name');
  if (gameId) query = query.eq('game_id', gameId);
  const { data } = await query;
  return (data ?? []).map((team) => ({
    ...team,
    official_team_players: [...(team.official_team_players ?? [])].sort(
      (a, b) => Number(b.is_captain) - Number(a.is_captain) || a.display_order - b.display_order
    ),
  }));
}
