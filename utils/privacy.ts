// Privacy Notice details shared by /privacy, the register page and /privacy/consent.

// The date the Privacy Notice last changed. It is saved with each user's consent
// (profiles.privacy_consent_version), so we know which version they agreed to.
// If the notice changes in an important way, update this date.
// 2026-10-17: added student verification (student ID, school, course/year).
// 2026-10-17.2: added the activity log. (Only the first 10 characters are shown as the date.)
// 2026-10-18: added pick'em predictions and leaderboards (first name + initial shown to logged-in users).
// 2026-10-18.2: disclosed match-proof retention, exports, public rosters/officers, check-ins.
// 2026-10-18.3: the under-18 section now points to the Terms of Service age declaration.
// 2026-11-01: account emails are now sent through Brevo; the website is hosted on Vercel (was Railway).
// 2026-11-08: optional profile pictures (shown to logged-in users; public file address).
// 2026-11-08.2: stream comments (public on tournament pages), AI moderation, warnings and bans.
// 2026-11-09: game-specific profiles: game account IDs (Riot ID, MLBB User/Zone ID, CODM UID, Tekken ID),
//   server/platform and favorite heroes; visible only to the player and organizers (202611091500).
// 2026-11-09.2: comment reports (who reported which comment, seen by staff/admins), notification
//   settings, and two-factor authentication keys for organizers who turn it on (202611091900).
// 2026-11-09.3: announcement reactions (which reactions you gave; others only see totals) and which
//   announcements you opened (NEW badge), visible only to you (202611092000).
export const PRIVACY_NOTICE_VERSION = '2026-11-09.3';

// Where people send privacy requests and questions. Set the real contact in
// NEXT_PUBLIC_PRIVACY_CONTACT_* before going live; the fallbacks are placeholders.
export const PRIVACY_CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL || 'its.molino@perpetualdalta.edu.ph';
export const PRIVACY_CONTACT_PERSON =
  process.env.NEXT_PUBLIC_PRIVACY_CONTACT_PERSON || 'DALTA Esports Data Privacy Officer';
