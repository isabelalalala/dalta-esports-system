// Public website content (see migration 202610171600_public_website): types, the editable
// text fields, and image URLs. Safe to import from server and client components.

export const SITE_IMAGES_BUCKET = 'site-images';
// Used when no logo has been uploaded on /admin/website
export const DEFAULT_LOGO = '/daltaesportslogo.jpg';

// Every text an admin can edit. The admin page builds its form from this list,
// and the defaults are shown if a key is missing in the database.
export const SITE_CONTENT_FIELDS = [
  { key: 'hero_title', label: 'Hero title', group: 'Home', multiline: false, fallback: 'DALTA ESPORTS' },
  { key: 'hero_tagline', label: 'Hero tagline', group: 'Home', multiline: false, fallback: 'The official esports organization of UPHSD – Molino Campus' },
  { key: 'about_intro', label: 'About Us', group: 'About', multiline: true, fallback: '' },
  { key: 'founded', label: 'Founded', group: 'About', multiline: false, fallback: 'February 2025' },
  { key: 'our_story', label: 'Our Story', group: 'About', multiline: true, fallback: '' },
  { key: 'mission', label: 'Mission', group: 'About', multiline: true, fallback: '' },
  { key: 'vision', label: 'Vision', group: 'About', multiline: true, fallback: '' },
  { key: 'core_belief_title', label: 'Core belief (title)', group: 'About', multiline: false, fallback: 'Game With Purpose' },
  { key: 'core_belief_text', label: 'Core belief (text)', group: 'About', multiline: true, fallback: '' },
  { key: 'footer_tagline', label: 'Footer tagline', group: 'Footer', multiline: false, fallback: 'Game With Purpose' },
  { key: 'footer_copyright', label: 'Footer copyright', group: 'Footer', multiline: false, fallback: '© 2026 DALTA Esports' },
  { key: 'social_facebook', label: 'Facebook page link', group: 'Connect With Us', multiline: false, fallback: '' },
  { key: 'social_instagram', label: 'Instagram link', group: 'Connect With Us', multiline: false, fallback: '' },
  { key: 'social_tiktok', label: 'TikTok link', group: 'Connect With Us', multiline: false, fallback: '' },
  { key: 'social_youtube', label: 'YouTube link', group: 'Connect With Us', multiline: false, fallback: '' },
  { key: 'contact_email', label: 'Contact email', group: 'Connect With Us', multiline: false, fallback: '' },
] as const;

export type SiteContentKey = (typeof SITE_CONTENT_FIELDS)[number]['key'] | 'logo_path' | 'about_image_path';
export type SiteContent = Record<SiteContentKey, string>;

export const DEFAULT_SITE_CONTENT = {
  ...Object.fromEntries(SITE_CONTENT_FIELDS.map((f) => [f.key, f.fallback])),
  logo_path: '',
  about_image_path: '',
} as SiteContent;

export interface HeroImage {
  id: string;
  image_path: string;
  caption: string;
  link: string | null;
  display_order: number;
  is_published: boolean;
}

// Campaigns and events have the same fields (events can also link to a tournament)
export interface SitePost {
  id: string;
  title: string;
  description: string;
  image_path: string | null;
  event_date: string | null;
  link: string | null;
  tournament_id?: string | null;
  display_order: number;
  is_published: boolean;
}

export interface GameDivision {
  game_id: string;
  tagline: string;
  description: string;
  image_path: string | null;
  display_order: number;
  is_published: boolean;
  // Only present when selected with `games(name)`
  games?: { name: string } | null;
}

export type OfficerCategory = 'core_officer' | 'division_head' | 'coach' | 'committee';

export const officerCategoryLabels: Record<OfficerCategory, string> = {
  core_officer: 'Core Officers',
  division_head: 'Game Division Heads',
  coach: 'Coaches / Managers',
  committee: 'Committees',
};

export interface Officer {
  id: string;
  name: string;
  position: string;
  category: OfficerCategory;
  game_id: string | null;
  photo_path: string | null;
  display_order: number;
  is_published: boolean;
  games?: { name: string } | null;
}

export interface OfficialTeamPlayer {
  id: string;
  team_id: string;
  name: string;
  ign: string;
  role: string;
  is_captain: boolean;
  photo_path: string | null;
  display_order: number;
}

export interface OfficialTeam {
  id: string;
  name: string;
  subname: string;
  game_id: string;
  description: string;
  photo_path: string | null;
  display_order: number;
  is_published: boolean;
  games?: { name: string } | null;
  official_team_players?: OfficialTeamPlayer[];
}

// Public URL of a file in the site-images bucket (the bucket is public)
export function siteImageUrl(path: string | null | undefined) {
  if (!path) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${SITE_IMAGES_BUCKET}/${path}`;
}

export function logoUrl(content: SiteContent) {
  return siteImageUrl(content.logo_path) ?? DEFAULT_LOGO;
}
