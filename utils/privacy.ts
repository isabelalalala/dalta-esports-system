// Privacy Notice details shared by /privacy, the register page and /privacy/consent.

// The date the Privacy Notice last changed. It is saved with each user's consent
// (profiles.privacy_consent_version), so we know which version they agreed to.
// If the notice changes in an important way, update this date.
// 2026-10-17: added student verification (student ID, school, course/year).
// 2026-10-17.2: added the activity log. (Only the first 10 characters are shown as the date.)
// 2026-10-18: added pick'em predictions and leaderboards (first name + initial shown to logged-in users).
// 2026-10-18.2: disclosed match-proof retention, exports, public rosters/officers, check-ins.
// 2026-10-18.3: the under-18 section now points to the Terms of Service age declaration.
export const PRIVACY_NOTICE_VERSION = '2026-10-18.3';

// Where people send privacy requests and questions. Set the real contact in
// NEXT_PUBLIC_PRIVACY_CONTACT_* before going live; the fallbacks are placeholders.
export const PRIVACY_CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL || 'its.molino@perpetualdalta.edu.ph';
export const PRIVACY_CONTACT_PERSON =
  process.env.NEXT_PUBLIC_PRIVACY_CONTACT_PERSON || 'DALTA Esports Data Privacy Officer';
