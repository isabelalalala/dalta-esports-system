import { Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getOfficialTeams } from '@/utils/site-data';
import { siteImageUrl } from '@/utils/site';
import { PageTitle, Paragraphs, PersonPhoto, SectionTitle, SiteBox } from '@/components/site/SiteParts';
import { SectionLoading } from '@/components/PageLoading';

// Official team page (wireframe: captain profile, player profiles with "IGN – role", team description).
export default function OfficialTeamPage({ params }: PageProps<'/divisions/[game]/[team]'>) {
  return (
    <Suspense fallback={<SectionLoading />}>
      <OfficialTeam params={params} />
    </Suspense>
  );
}

async function OfficialTeam({ params }: { params: PageProps<'/divisions/[game]/[team]'>['params'] }) {
  const { game, team: teamId } = await params;
  const team = (await getOfficialTeams(game)).find((t) => t.id === teamId);
  if (!team) notFound();

  const players = team.official_team_players ?? [];
  const captain = players.find((p) => p.is_captain);
  const others = players.filter((p) => !p.is_captain);
  const photo = siteImageUrl(team.photo_path);

  return (
    <div className="space-y-8">
      <Link href={`/divisions/${game}`} className="text-sm text-gold hover:underline">← {team.games?.name} division</Link>
      <PageTitle title={team.name} subtitle={[team.subname, team.games?.name].filter(Boolean).join(' · ')} />

      {photo && (
        <div className="relative aspect-video border-2 border-gold overflow-hidden shadow-[6px_6px_0_var(--color-brown)]">
          <Image src={photo} alt={team.name} fill unoptimized className="object-cover" />
        </div>
      )}
      {team.description && (
        <SiteBox>
          <Paragraphs text={team.description} />
        </SiteBox>
      )}

      {captain && (
        <section>
          <SectionTitle>Captain</SectionTitle>
          <SiteBox className="flex flex-col sm:flex-row items-center gap-5">
            <PersonPhoto path={captain.photo_path} name={captain.name || captain.ign} size="lg" />
            <div className="text-center sm:text-left">
              <p className="font-pixel text-gold text-sm leading-relaxed">{captain.ign}</p>
              {captain.role && <p className="text-gray-300">{captain.role}</p>}
              {captain.name && <p className="text-sm text-gray-400 mt-1">{captain.name}</p>}
            </div>
          </SiteBox>
        </section>
      )}

      <section>
        <SectionTitle>Players</SectionTitle>
        {others.length === 0 ? (
          <p className="text-gray-400">No other players listed yet.</p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {others.map((p) => (
              <li key={p.id} className="flex items-center gap-4 border-2 border-brownlight bg-sitecard p-3 shadow-[4px_4px_0_var(--color-brown)]">
                <PersonPhoto path={p.photo_path} name={p.name || p.ign} size="sm" />
                <div>
                  {/* "IGN – role" as in the wireframe */}
                  <p className="font-bold text-white">{p.ign}{p.role && <span className="text-gold font-normal"> – {p.role}</span>}</p>
                  {p.name && <p className="text-sm text-gray-400">{p.name}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
