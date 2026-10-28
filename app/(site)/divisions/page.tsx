import Image from 'next/image';
import Link from 'next/link';
import { getDivisions, getOfficialTeams, getSiteContent } from '@/utils/site-data';
import { heroBannerUrl, siteImageUrl } from '@/utils/site';
import { EmptyNote } from '@/components/site/SiteParts';
import PageHeroBackground from '@/components/site/PageHeroBackground';

// Match division ID or game name to official game logo in public/
function getGameLogo(gameId: string, gameName?: string | null): string | null {
  const id = (gameId || '').toLowerCase().trim();
  const name = (gameName || '').toLowerCase().trim();

  if (id === 'mlbb' || id.includes('mlbb') || name.includes('mobile legends')) {
    return '/MLBB LOGO.png';
  }
  if (id === 'valorant' || id.includes('valo') || name.includes('valorant')) {
    return '/VALO LOGO.png';
  }
  if (id === 'tekken8' || id.includes('tekken') || name.includes('tekken')) {
    return '/TEKKEMN 8 LOGO.png';
  }
  if (id === 'codm' || id.includes('cod') || name.includes('call of duty')) {
    return '/CODM LOGO.png';
  }
  return null;
}

// Game Divisions Page
export const instant = false;

export default async function DivisionsPage() {
  'use cache';
  const [divisions, teams, content] = await Promise.all([
    getDivisions(),
    getOfficialTeams(),
    getSiteContent(),
  ]);
  const heroBg = heroBannerUrl(content, 'divisions_hero_bg_path');

  return (
    <div className="w-full space-y-8 uppercase">
      {/* Main Hero Container with dynamic background */}
      <section className="animate-hero-entrance relative w-full rounded-3xl border border-stone-800/80 bg-stone-950 overflow-hidden shadow-md p-8 sm:p-14 lg:p-16 text-center text-white flex flex-col items-center justify-center space-y-4">
        <PageHeroBackground src={heroBg} alt="DALTA Esports Divisions Banner" />

        <div className="relative z-10 max-w-4xl mx-auto space-y-3">
          <h1
            className="animate-hero-title text-4xl sm:text-5xl lg:text-6xl font-black !text-white text-white tracking-wider uppercase leading-tight"
            style={{ color: '#ffffff' }}
          >
            Game Divisions
          </h1>
          <p
            className="animate-hero-tagline text-base sm:text-lg !text-white text-stone-200 font-medium uppercase tracking-wide leading-relaxed"
            style={{ color: '#ffffff' }}
          >
            Our official teams, one division per game.
          </p>
        </div>
      </section>

      {divisions.length === 0 ? (
        <EmptyNote>No divisions yet.</EmptyNote>
      ) : (
        <div className="animate-stagger-1 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 sm:gap-8">
          {divisions.map((d) => {
            const logo = getGameLogo(d.game_id, d.games?.name);
            const customImage = siteImageUrl(d.image_path);
            const teamCount = teams.filter((t) => t.game_id === d.game_id).length;

            return (
              <Link
                key={d.game_id}
                href={`/divisions/${d.game_id}`}
                className="group rounded-3xl border border-stone-200/90 bg-white shadow-xs hover:shadow-xl hover:-translate-y-1.5 hover:border-[#FFCC37]/70 transition-all duration-300 overflow-hidden flex flex-col"
              >
                {/* Showcase Image Container Matching Image 2 */}
                <div className="relative aspect-video border-b border-stone-800/80 bg-[#0e0c0b] overflow-hidden grid place-items-center">
                  {/* Atmospheric Corner Glow Spotlight */}
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background:
                        'radial-gradient(circle at 88% 88%, rgba(164, 148, 140, 0.45) 0%, rgba(35, 30, 27, 0.8) 45%, #0e0c0b 100%)',
                    }}
                  />

                  {/* Top-Right Badge Tag matching the screenshot */}
                  <div className="absolute top-3.5 right-3.5 z-10">
                    <span className="px-3 py-1 rounded-full border border-[#FFCC37]/80 bg-black/60 text-[#FFCC37] text-[10px] sm:text-[11px] font-black uppercase tracking-wider backdrop-blur-xs shadow-xs">
                      {teamCount > 0 ? 'ACTIVE' : 'UPCOMING'}
                    </span>
                  </div>

                  {logo ? (
                    <div className="relative z-0 w-full h-full p-8 flex items-center justify-center">
                      <div className="relative w-full h-full max-w-[240px] max-h-[130px]">
                        <Image
                          src={logo}
                          alt={d.games?.name ?? d.game_id}
                          fill
                          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 400px"
                          className="object-contain drop-shadow-[0_6px_24px_rgba(0,0,0,0.7)] group-hover:scale-108 transition-transform duration-300"
                        />
                      </div>
                    </div>
                  ) : customImage ? (
                    <Image
                      src={customImage}
                      alt={d.games?.name ?? d.game_id}
                      fill
                      sizes="(max-width: 768px) 100vw, 400px"
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <span className="font-black text-stone-200 text-sm uppercase tracking-wider">{d.games?.name}</span>
                  )}
                </div>

                {/* Card Information */}
                <div className="p-6 flex-1 flex flex-col justify-between">
                  <div>
                    <h2 className="font-black text-stone-950 text-lg uppercase tracking-wide group-hover:text-[#5B271E] transition-colors">
                      {d.games?.name}
                    </h2>
                    <p className="text-xs sm:text-sm text-stone-600 font-medium uppercase tracking-wide mt-1.5 leading-relaxed">
                      {d.tagline}
                    </p>
                  </div>
                  <p className="text-xs text-[#5B271E] font-extrabold uppercase tracking-wider mt-4 flex items-center justify-between group-hover:text-[#FFCC37] transition-colors">
                    <span>{teamCount === 0 ? 'Teams coming soon' : `${teamCount} official team${teamCount === 1 ? '' : 's'}`}</span>
                    <span className="group-hover:translate-x-1.5 transition-transform">→</span>
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
