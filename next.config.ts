import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === 'development';
// The Supabase project (API, Realtime websocket, storage images)
const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
  : 'https://*.supabase.co';
const supabaseWs = supabaseOrigin.replace(/^https:/, 'wss:');

// Content-Security-Policy without nonces (Next.js guide "Without Nonces"): nonces would force every
// page to render dynamically and don't work with partial prerendering, so inline scripts are
// allowed but every OTHER source is limited to what the app really uses: Supabase (data,
// Realtime, images) and the Facebook video embed. Gemini and the Facebook link resolver are
// called from the server only, so they don't appear here.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabaseOrigin}`,
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigin} ${supabaseWs}`,
  'frame-src https://www.facebook.com https://web.facebook.com',
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ['upgrade-insecure-requests']),
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
];

// Logged-in pages (same list as proxy.ts) and the API: never in search results
const privatePaths = [
  '/dashboard', '/teams', '/profile', '/tournaments/create', '/matches', '/admin', '/registrations',
  '/announcements', '/schedule', '/live', '/feedback', '/analytics', '/notifications', '/privacy/consent',
  '/terms/accept', '/auth', '/banned', '/api',
];

const nextConfig: NextConfig = {
  // Don't advertise the framework in a response header
  poweredByHeader: false,
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      ...privatePaths.flatMap((path) => [
        { source: path, headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
        { source: `${path}/:rest*`, headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
      ]),
      {
        source: '/tournaments/:id/:section(edit|registrations|matches|streams|predictions)',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ];
  },
  // 'standalone' is for the Docker image (see Dockerfile). Vercel builds the app its own way,
  // so it is skipped there (VERCEL is set during Vercel builds).
  output: process.env.VERCEL ? undefined : 'standalone',
  images: {
    // Site images live in the public Supabase `site-images` bucket
    remotePatterns: [
      {
        protocol: 'https',
        hostname: process.env.NEXT_PUBLIC_SUPABASE_URL
          ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
          : '**.supabase.co',
      },
    ],
  },
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
