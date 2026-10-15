import Link from 'next/link';
import { getOfficers, getOfficialTeams } from '@/utils/site-data';
import { officerCategoryLabels, type Officer, type OfficerCategory } from '@/utils/site';
import { EmptyNote, PageTitle, PersonCard, PersonPhoto, SectionTitle } from '@/components/site/SiteParts';

// Officer sections, in the wireframe's order (after Members)
const officerSections: OfficerCategory[] = ['coach', 'core_officer', 'division_head', 'committee'];

// The DALTA Community (wireframe: Members, Coaches/Managers, Core Officers, Game Division Heads,
// Committees). Members are the players of the official teams, grouped by game.
export default async function CommunityPage() {
  const [officers, teams] = await Promise.all([getOfficers(), getOfficialTeams()]);

  // Game name -> its official teams' players
  const membersByGame = new Map<string, { team: string; ign: string; role: string; name: string; photo: string | null }[]>();
  for (const team of teams) {
    const game = team.games?.name ?? team.game_id;
    const list = membersByGame.get(game) ?? [];
    for (const p of team.official_team_players ?? []) {
      list.push({ team: team.name, ign: p.ign, role: p.role, name: p.name, photo: p.photo_path });
    }
    membersByGame.set(game, list);
  }

  const sectionIds: Record<string, string> = { members: 'Members' };
  for (const c of officerSections) sectionIds[c] = officerCategoryLabels[c];

  return (
    <div className="space-y-12">
      <PageTitle title="The DALTA Community" subtitle="The people behind DALTA Esports." />

      {/* Jump links */}
      <nav aria-label="Community sections" className="flex flex-wrap gap-2 -mt-4">
        {Object.entries(sectionIds).map(([id, label]) => (
          <a key={id} href={`#${id}`} className="px-3 py-1 border-2 border-brownlight text-sm hover:border-gold hover:text-gold">
            {label}
          </a>
        ))}
      </nav>

      <section id="members" className="scroll-mt-6">
        <SectionTitle>Members</SectionTitle>
        {membersByGame.size === 0 ? (
          <EmptyNote>Our official team rosters will appear here.</EmptyNote>
        ) : (
          <div className="space-y-6">
            {[...membersByGame.entries()].map(([game, members]) => (
              <div key={game}>
                <h3 className="font-bold text-white mb-3">{game}</h3>
                <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {members.map((m, i) => (
                    <li key={i} className="flex items-center gap-3 border-2 border-brownlight bg-sitecard p-3">
                      <PersonPhoto path={m.photo} name={m.name || m.ign} size="sm" />
                      <div className="min-w-0">
                        <p className="font-bold text-white truncate">{m.ign}{m.role && <span className="text-gold font-normal"> – {m.role}</span>}</p>
                        <p className="text-xs text-gray-400 truncate">{m.team}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <p className="text-sm text-gray-400">
              See each team on <Link href="/divisions" className="text-gold hover:underline">Game Divisions</Link>.
            </p>
          </div>
        )}
      </section>

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

function OfficerSection({ id, title, people }: { id: string; title: string; people: Officer[] }) {
  return (
    <section id={id} className="scroll-mt-6">
      <SectionTitle>{title}</SectionTitle>
      {people.length === 0 ? (
        <EmptyNote>Coming soon.</EmptyNote>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {people.map((o) => (
            <PersonCard key={o.id} name={o.name} line={o.position} extra={o.games?.name} photoPath={o.photo_path} />
          ))}
        </div>
      )}
    </section>
  );
}
