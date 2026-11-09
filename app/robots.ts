import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/utils/site-url';

// /robots.txt: the public website, public tournament pages and legal pages may be crawled; the
// logged-in app and the API may not (they also send X-Robots-Tag: noindex, see next.config.ts).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/dashboard', '/teams', '/profile', '/tournaments/create', '/matches', '/admin', '/registrations',
        '/announcements', '/schedule', '/live', '/feedback', '/analytics', '/notifications', '/auth/',
        '/privacy/consent', '/terms/accept', '/banned', '/api/',
      ],
    },
    host: SITE_URL,
  };
}
