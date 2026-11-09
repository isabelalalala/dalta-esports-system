import type { MetadataRoute } from 'next';

// Makes the site installable as an app ("Add to Home Screen"): name, icons (made from the DALTA
// logo, public/icons), colors for the splash screen. The offline page comes from public/sw.js.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'DALTA Esports',
    short_name: 'DALTA',
    description: 'Tournaments, teams, live matches and results of DALTA Esports (UPHSD Molino).',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#5B271E',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
