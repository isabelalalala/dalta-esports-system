import Link from 'next/link';
import { Gamepad2 } from 'lucide-react';
import { getOfficers, getOfficialTeams, getSiteContent } from '@/utils/site-data';
import { heroBannerUrl, officerCategoryLabels, type Officer, type OfficerCategory } from '@/utils/site';
import { EmptyNote, PersonCard } from '@/components/site/SiteParts';
import PageHeroBackground from '@/components/site/PageHeroBackground';

// Officer sections in order matching the hero jump navigation
const officerSections: OfficerCategory[] = ['coach', 'core_officer', 'division_head', 'committee'];

const NAV_BUTTONS = [
  { id: 'members', label: 'MEMBERS' },
  { id: 'coach', label: 'COACHES/MANAGERS' },
  { id: 'core_officer', label: 'CORE OFFICERS' },
  { id: 'division_head', label: 'GAME DIVISION HEADS' },
  { id: 'committee', label: 'COMMITTEES' },
];

export const instant = false;

export default async function CommunityPage() {
  'use cache';
  const [officers, teams, content] = await Promise.all([
    getOfficers(),
    getOfficialTeams(),
    getSiteContent(),
  ]);
  const heroBg = heroBannerUrl(content, 'community_hero_bg_path');

  // Game name -> its official teams' players
  const membersByGame = new Map<
    string,
    { team: string; ign: string; role: string; name: string; photo: string | null }[]
  >();

  for (const team of teams) {
    const game = team.games?.name ?? team.game_id;
    const list = membersByGame.get(game) ?? [];
    for (const p of team.official_team_players ?? []) {
      list.push({
        team: team.name,
        ign: p.ign,
        role: p.role,
        name: p.name,
        photo: p.photo_path,
      });
    }
    membersByGame.set(game, list);
  }

  return (
    <div className="w-full space-y-12 sm:space-y-16 uppercase">
      {/* 1. Main Hero Container with Background & In-Container Jump Navigation */}
      <section className="animate-hero-entrance relative w-full rounded-3xl border border-stone-800/80 bg-stone-950 overflow-hidden shadow-md p-8 sm:p-14 lg:p-16 text-center text-white flex flex-col items-center justify-center space-y-6">
        <PageHeroBackground src={heroBg} alt="The DALTA Community Banner" />

        <div className="relative z-10 max-w-4xl mx-auto space-y-3">
          <h1
            className="animate-hero-title text-4xl sm:text-5xl lg:text-6xl font-black !text-white text-white tracking-wider uppercase leading-tight"
            style={{ color: '#ffffff' }}
          >
            The DALTA Community
          </h1>
          <p
            className="animate-hero-tagline text-base sm:text-lg !text-white text-stone-200 font-medium uppercase tracking-wide leading-relaxed"
            style={{ color: '#ffffff' }}
          >
            The people behind DALTA Esports.
          </p>
        </div>

        {/* Jump navigation buttons without border lines */}
        <nav
          aria-label="Community navigation"
          className="relative z-10 flex flex-wrap items-center justify-center gap-x-6 sm:gap-x-8 gap-y-2 pt-2"
        >
          {NAV_BUTTONS.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className="text-xs sm:text-sm font-black tracking-widest text-stone-200 hover:text-amber-400 uppercase transition-colors py-1 cursor-pointer"
            >
              {item.label}
            </a>
          ))}
        </nav>
      </section>

      {/* 2. Members Section */}
      <section id="members" className="animate-stagger-1 scroll-mt-28 space-y-6">
        <div className="border-b border-stone-200/80 pb-3">
          <h2 className="font-black text-stone-950 text-xl sm:text-2xl uppercase tracking-wider">
            Members
          </h2>
        </div>

        {membersByGame.size === 0 ? (
          <EmptyNote>Our official team rosters will appear here.</EmptyNote>
        ) : (
          <div className="space-y-10">
            {[...membersByGame.entries()].map(([game, members]) => (
              <div key={game} className="space-y-4">
                <div className="flex items-center gap-2.5 pb-1">
                  <Gamepad2 className="h-5 w-5 text-amber-700 shrink-0" />
                  <h3 className="font-black text-stone-950 text-base sm:text-lg uppercase tracking-wider">
                    {game}
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {members.map((m, i) => (
                    <PersonCard
                      key={i}
                      name={m.ign}
                      line={m.role ? `${m.role}${m.name ? ` · ${m.name}` : ''}` : m.name}
                      extra={m.team}
                      photoPath={m.photo}
                    />
                  ))}
                </div>
              </div>
            ))}

            <p className="text-xs sm:text-sm text-stone-600 font-semibold uppercase tracking-wide pt-2">
              See each team on{' '}
              <Link
                href="/divisions"
                className="text-amber-800 font-black uppercase hover:underline"
              >
                Game Divisions →
              </Link>
            </p>
          </div>
        )}
      </section>

      {/* 3. Officers Sections (Coaches/Managers, Core Officers, Game Division Heads, Committees) */}
      {officerSections.map((category) => (
        <OfficerSection
          key={category}
          id={category}
          title={officerCategoryLabels[category]}
          people={officers.filter((o) => o.category === category)}
        />
      ))}
    </div>
  );
}

function OfficerSection({
  id,
  title,
  people,
}: {
  id: string;
  title: string;
  people: Officer[];
}) {
  return (
    <section id={id} className="scroll-mt-28 space-y-6">
      <div className="border-b border-stone-200/80 pb-3">
        <h2 className="font-black text-stone-950 text-xl sm:text-2xl uppercase tracking-wider">
          {title}
        </h2>
      </div>

      {people.length === 0 ? (
        <EmptyNote>Coming soon.</EmptyNote>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {people.map((o) => (
            <PersonCard
              key={o.id}
              name={o.name}
              line={o.position}
              extra={o.games?.name}
              photoPath={o.photo_path}
            />
          ))}
        </div>
      )}
    </section>
  );
}
