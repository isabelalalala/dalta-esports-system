import { Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDivisions, getOfficialTeams } from '@/utils/site-data';
import { siteImageUrl } from '@/utils/site';
import { EmptyNote, Paragraphs, SiteBox } from '@/components/site/SiteParts';
import PageLoading from '@/components/PageLoading';
import PageHeroBackground from '@/components/site/PageHeroBackground';
import { Users, Gamepad2 } from 'lucide-react';

// One game division and its official teams.
// The game comes from the URL (only known at request time), so the content is inside Suspense.
export default function DivisionPage({ params }: PageProps<'/divisions/[game]'>) {
  return (
    <Suspense fallback={<PageLoading variant="grid" label="Loading division..." />}>
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
    <div className="w-full space-y-8 uppercase text-stone-950">
      {/* 1. Main Hero Container with dynamic background */}
      <section className="animate-hero-entrance relative w-full rounded-3xl border border-stone-800/80 bg-stone-950 overflow-hidden shadow-md p-8 sm:p-12 lg:p-14 text-center text-white flex flex-col items-center justify-center space-y-4">
        <PageHeroBackground specificKey="divisions_hero_bg_path" alt="DALTA Esports Divisions Banner" />

        {/* Action Bar inside Hero: Back link & Team count badge */}
        <div className="relative z-10 w-full flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/divisions"
            className="inline-flex items-center gap-1.5 text-xs font-black text-[#FFCC37] hover:text-[#FFE066] uppercase tracking-wider transition-colors"
          >
            ← All Divisions
          </Link>
          <span className="text-[10px] sm:text-xs font-black px-3.5 py-1 rounded-md border border-white/20 bg-white/10 text-stone-200 uppercase tracking-widest backdrop-blur-xs shadow-2xs">
            {teams.length} Official {teams.length === 1 ? 'Team' : 'Teams'}
          </span>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto space-y-3 pt-2">
          <h1
            className="animate-hero-title text-3xl sm:text-4xl lg:text-5xl font-black !text-white text-white tracking-wider uppercase leading-tight"
            style={{ color: '#ffffff' }}
          >
            {division.games?.name ?? game}
          </h1>
          {division.tagline && (
            <p
              className="animate-hero-tagline text-base sm:text-lg !text-white text-stone-200 font-medium uppercase tracking-wide leading-relaxed"
              style={{ color: '#ffffff' }}
            >
              {division.tagline}
            </p>
          )}
        </div>
      </section>

      {/* 2. Division Description (if present) */}
      {division.description && (
        <div className="animate-stagger-1 rounded-3xl border border-stone-200/90 bg-white p-6 sm:p-8 shadow-xs">
          <Paragraphs text={division.description} />
        </div>
      )}

      {/* 3. Official Teams Section */}
      <section className="animate-stagger-1 space-y-6">
        <div className="flex items-center gap-3 pb-3 border-b border-stone-200/90">
          <div className="w-10 h-10 rounded-xl bg-[#5B271E]/10 border border-[#5B271E]/20 text-[#5B271E] grid place-items-center shadow-2xs">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-black text-stone-950 text-xl tracking-wider">Official Teams</h2>
            <p className="text-xs text-stone-500 font-medium tracking-wide mt-0.5">
              Collegiate squads representing Perpetual Help in {division.games?.name ?? game}.
            </p>
          </div>
        </div>

        {teams.length === 0 ? (
          <EmptyNote>No official teams in this division yet.</EmptyNote>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
            {teams.map((team) => {
              const photo = siteImageUrl(team.photo_path);
              const captain = team.official_team_players?.find((p) => p.is_captain);
              return (
                <Link
                  key={team.id}
                  href={`/divisions/${game}/${team.id}`}
                  className="group rounded-3xl border border-stone-200/90 bg-white shadow-xs hover:shadow-xl hover:-translate-y-1.5 hover:border-[#FFCC37]/80 transition-all duration-300 overflow-hidden flex flex-col"
                >
                  <div className="relative aspect-video border-b border-stone-100 bg-stone-100 overflow-hidden grid place-items-center">
                    {photo ? (
                      <Image
                        src={photo}
                        alt=""
                        fill
                        sizes="(max-width: 768px) 100vw, 500px"
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-stone-400">
                        <Gamepad2 className="w-8 h-8" />
                        <span className="font-black text-stone-600 text-sm uppercase tracking-wider">
                          {team.name}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-6 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="font-black text-stone-950 text-lg uppercase tracking-wide group-hover:text-[#5B271E] transition-colors">
                        {team.name}
                      </h3>
                      {team.subname && (
                        <p className="text-xs text-stone-500 font-bold uppercase tracking-wider mt-1">
                          {team.subname}
                        </p>
                      )}
                    </div>
                    <div className="text-xs font-black uppercase tracking-wider mt-5 pt-3 border-t border-stone-100 flex items-center justify-between text-[#5B271E]">
                      <span>
                        {team.official_team_players?.length ?? 0} Players
                        {captain && ` · Cpt: ${captain.ign}`}
                      </span>
                      <span className="group-hover:translate-x-1.5 group-hover:text-[#FFCC37] transition-all">
                        View Team →
                      </span>
                    </div>
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
