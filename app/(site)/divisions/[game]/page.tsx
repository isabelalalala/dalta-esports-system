import { Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDivisions, getOfficialTeams } from '@/utils/site-data';
import { siteImageUrl } from '@/utils/site';
import { EmptyNote, PageTitle, Paragraphs, SiteBox } from '@/components/site/SiteParts';
import { SectionLoading } from '@/components/PageLoading';

// One game division and its official teams.
// The game comes from the URL (only known at request time), so the content is inside Suspense.
export default function DivisionPage({ params }: PageProps<'/divisions/[game]'>) {
  return (
    <Suspense fallback={<SectionLoading />}>
      <Division params={params} />
    </Suspense>
  );
}

async function Division({ params }: { params: PageProps<'/divisions/[game]'>['params'] }) {
  const { game } = await params;
  const [divisions, teams] = await Promise.all([getDivisions(), getOfficialTeams(game)]);
  const division = divisions.find((d) => d.game_id === game);
  if (!division) notFound();

  return (
    <div className="space-y-8">
      <Link href="/divisions" className="text-sm text-gold hover:underline">← All divisions</Link>
      <PageTitle title={division.games?.name ?? game} subtitle={division.tagline} />
      {division.description && (
        <SiteBox>
          <Paragraphs text={division.description} />
        </SiteBox>
      )}

      <section>
        <h2 className="font-pixel text-gold text-sm mb-4">Official Teams</h2>
        {teams.length === 0 ? (
          <EmptyNote>No official teams in this division yet.</EmptyNote>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {teams.map((team) => {
              const photo = siteImageUrl(team.photo_path);
              const captain = team.official_team_players?.find((p) => p.is_captain);
              return (
                <Link
                  key={team.id}
                  href={`/divisions/${game}/${team.id}`}
                  className="group border-2 border-brownlight bg-sitecard shadow-[4px_4px_0_var(--color-brown)] hover:border-gold"
                >
                  <div className="relative aspect-video border-b-2 border-brownlight bg-brown/40 overflow-hidden grid place-items-center">
                    {photo ? (
                      <Image src={photo} alt="" fill sizes="(max-width: 768px) 100vw, 400px" className="object-cover" />
                    ) : (
                      <span className="font-pixel text-gold text-xs">{team.name}</span>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-white text-lg group-hover:text-gold">{team.name}</h3>
                    {team.subname && <p className="text-sm text-gray-400">{team.subname}</p>}
                    <p className="text-xs text-gray-400 mt-2">
                      {team.official_team_players?.length ?? 0} players
                      {captain && ` · Captain: ${captain.ign}`}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
