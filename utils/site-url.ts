// The app's public address, for links that leave the site (shared links, Open Graph images,
// calendar files). Set NEXT_PUBLIC_SITE_URL in .env and on Vercel, e.g.
// https://dalta-esports.vercel.app (no slash at the end). If it is missing on Vercel, the
// project's production domain (a Vercel system variable) is used instead of localhost.
const vercelDomain = process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL;
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (vercelDomain ? `https://${vercelDomain}` : 'http://localhost:3000')
).replace(/\/$/, '');

export function publicTournamentPath(tournamentId: string) {
  return `/t/${tournamentId}`;
}

export function publicMatchPath(tournamentId: string, matchId: string) {
  return `/t/${tournamentId}/match/${matchId}`;
}

// Calendar files: /calendar/match/<id>, /calendar/tournament/<id>, /calendar/team/<id>
export function calendarPath(kind: 'match' | 'tournament' | 'team', id: string) {
  return `/calendar/${kind}/${id}`;
}

// webcal:// makes calendar apps subscribe (and keep updating) instead of importing once
export function webcalUrl(path: string) {
  return `${SITE_URL}${path}`.replace(/^https?:/, 'webcal:');
}
