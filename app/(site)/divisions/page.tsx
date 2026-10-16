import Image from 'next/image';
import Link from 'next/link';
import { getDivisions, getOfficialTeams } from '@/utils/site-data';
import { siteImageUrl } from '@/utils/site';
import { EmptyNote, PageTitle } from '@/components/site/SiteParts';

// Game Divisions (wireframe: MLBB, VALO, Tekken 8, League, CODM -> official teams per division)
export default async function DivisionsPage() {
  const [divisions, teams] = await Promise.all([getDivisions(), getOfficialTeams()]);

  return (
    <div>
      <PageTitle title="Game Divisions" subtitle="Our official teams, one division per game." />
      {divisions.length === 0 ? (
        <EmptyNote>No divisions yet.</EmptyNote>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {divisions.map((d) => {
            const image = siteImageUrl(d.image_path);
            const teamCount = teams.filter((t) => t.game_id === d.game_id).length;
            return (
              <Link
                key={d.game_id}
                href={`/divisions/${d.game_id}`}
                className="group border-2 border-brownlight bg-sitecard shadow-[4px_4px_0_var(--color-brown)] hover:border-gold"
              >
                <div className="relative aspect-video border-b-2 border-brownlight bg-brown/40 overflow-hidden grid place-items-center">
                  {image ? (
                    <Image src={image} alt="" fill sizes="(max-width: 768px) 100vw, 400px" className="object-cover group-hover:scale-105 transition-transform" />
                  ) : (
                    <span className="font-pixel text-gold text-sm">{d.games?.name}</span>
                  )}
                </div>
                <div className="p-4">
                  <h2 className="font-bold text-white text-lg group-hover:text-gold">{d.games?.name}</h2>
                  <p className="text-sm text-gray-400">{d.tagline}</p>
                  <p className="text-xs text-gold mt-2">
                    {teamCount === 0 ? 'Teams coming soon' : `${teamCount} official team${teamCount === 1 ? '' : 's'}`} →
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
