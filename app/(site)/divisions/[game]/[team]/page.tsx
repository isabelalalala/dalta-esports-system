import { Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getOfficialTeams } from '@/utils/site-data';
import { siteImageUrl } from '@/utils/site';
import { EmptyNote, Paragraphs, PersonPhoto } from '@/components/site/SiteParts';
import PageLoading from '@/components/PageLoading';
import PageHeroBackground from '@/components/site/PageHeroBackground';
import PlayerTradingCard from '@/components/site/PlayerTradingCard';
import { BadgeCheck, Crown, Shield, Users } from 'lucide-react';

// Official team page (wireframe: captain profile, player profiles with "IGN – role", team description).
export default function OfficialTeamPage({ params }: PageProps<'/divisions/[game]/[team]'>) {
  return (
    <Suspense fallback={<PageLoading variant="detail" label="Loading official team..." />}>
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
  const photo = siteImageUrl(team.photo_path);
  const gameName = team.games?.name ?? game;

  return (
    <div className="w-full space-y-8 text-stone-950">
      {/* 1. Main Hero Container (Matching Tournaments, Campaigns, and Events) */}
      <section className="animate-hero-entrance relative w-full rounded-3xl border border-stone-800/80 bg-stone-950 overflow-hidden shadow-md p-8 sm:p-12 @5xl:p-14 text-center text-white flex flex-col items-center justify-center space-y-4">
        <PageHeroBackground specificKey="divisions_hero_bg_path" alt="DALTA Esports Official Team Banner" />

        {/* Action Bar inside Hero: Back link & Badges */}
        <div className="relative z-10 w-full flex flex-wrap items-center justify-between gap-4">
          <Link
            href={`/divisions/${game}`}
            className="inline-flex items-center gap-1.5 text-xs font-black text-gold hover:text-goldlight uppercase tracking-wider transition-colors"
          >
            ← Back to {gameName} Division
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] sm:text-xs font-black px-3 py-1 rounded-md border border-gold/50 bg-gold/15 text-gold uppercase tracking-wider shadow-2xs">
              {gameName}
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-black px-3 py-1 rounded-md border border-white/20 bg-white/10 text-stone-200 uppercase tracking-widest backdrop-blur-xs">
              <BadgeCheck className="w-3.5 h-3.5 text-gold" /> Official Team
            </span>
            <span className="text-[10px] sm:text-xs font-black px-3 py-1 rounded-md border border-white/20 bg-white/10 text-stone-200 uppercase tracking-widest backdrop-blur-xs">
              {players.length} {players.length === 1 ? 'Player' : 'Players'}
            </span>
          </div>
        </div>

        {/* Team Titles */}
        <div className="relative z-10 max-w-4xl mx-auto space-y-3 pt-2">
          <h1
            className="animate-hero-title text-display font-black tracking-wider uppercase leading-tight text-white"
          >
            {team.name}
          </h1>
          <p
            className="animate-hero-tagline text-xs sm:text-sm font-semibold uppercase tracking-wider flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-white"
          >
            {team.subname && <span className="text-gold font-black">{team.subname}</span>}
            {team.subname && <span>•</span>}
            <span>{gameName} Division</span>
            <span>•</span>
            <span>{players.length} Active Roster Members</span>
          </p>
        </div>
      </section>

      {/* 2. Structured Content Showcase: Constrained Media Card + Team Overview */}
      <div className={`animate-stagger-1 grid grid-cols-1 ${photo ? '@5xl:grid-cols-12' : ''} gap-6 sm:gap-8 items-start`}>
        {/* Left Media Column: Constrained & Proportionate Photo */}
        {photo && (
          <div className="@5xl:col-span-5 w-full">
            <div className="relative aspect-[4/3] max-h-[380px] sm:max-h-[420px] w-full rounded-3xl border border-stone-800/80 bg-ink overflow-hidden shadow-md flex items-center justify-center p-4 sm:p-6">
              {/* Radial ambient lighting */}
              <div
                className="absolute inset-0 pointer-events-none z-0 bg-logo-stage"
              />
              {/* Official Roster Badge - Sits in front of the image with z-20 */}
              <div className="absolute top-4 right-4 z-20 pointer-events-none">
                <span className="text-[10px] font-black tracking-widest px-3 py-1.5 rounded-md border border-gold/60 bg-ink/85 text-gold uppercase backdrop-blur-md shadow-md">
                  Official Roster
                </span>
              </div>
              {/* Image Container - Stays behind the badge at z-10 */}
              <div className="relative z-10 w-full h-full flex items-center justify-center">
                <Image
                  src={photo}
                  alt={team.name}
                  fill
                  sizes="(max-width: 1024px) 100vw, 480px"
                  className="object-contain drop-shadow-md"
                />
              </div>
            </div>
          </div>
        )}

        {/* Right Information Column */}
        <div className={`${photo ? '@5xl:col-span-7' : 'w-full'} space-y-6`}>
          {/* Team Overview Card */}
          <div className="rounded-3xl border border-stone-200/90 bg-white p-6 sm:p-8 shadow-xs space-y-5">
            <div className="flex items-center gap-3 pb-4 border-b border-stone-100">
              <div className="w-10 h-10 rounded-xl bg-maroon/10 border border-maroon/20 text-maroon grid place-items-center shadow-2xs">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-stone-950 tracking-wider">Team Overview</h2>
                <p className="text-xs text-stone-500 font-medium tracking-wide mt-0.5">
                  Official collegiate competitive division profile.
                </p>
              </div>
            </div>

            {team.description ? (
              <Paragraphs text={team.description} />
            ) : (
              <p className="text-stone-600 text-xs sm:text-sm font-medium leading-relaxed">
                Official collegiate squad representing the University of Perpetual Help System DALTA Molino Campus in competitive {gameName} esports.
              </p>
            )}

            {/* Quick Specs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-stone-100 text-xs">
              <div className="p-4 rounded-2xl bg-stone-50/70 border border-stone-200/80 space-y-1">
                <span className="uppercase text-stone-500 font-black tracking-wider text-[11px] block">Game Discipline</span>
                <span className="font-extrabold text-stone-950 text-sm tracking-wide block">{gameName}</span>
              </div>
              <div className="p-4 rounded-2xl bg-stone-50/70 border border-stone-200/80 space-y-1">
                <span className="uppercase text-stone-500 font-black tracking-wider text-[11px] block">Active Roster</span>
                <span className="font-extrabold text-stone-950 text-sm tracking-wide block">{players.length} Registered Players</span>
              </div>
            </div>
          </div>

          {/* Captain Spotlight Card (if captain exists) */}
          {captain && (
            <div className="rounded-3xl border border-amber-300/80 bg-gradient-to-br from-motto/80 via-surface to-motto/30 p-6 shadow-xs flex flex-col sm:flex-row items-center gap-5">
              <PersonPhoto path={captain.photo_path} name={captain.name || captain.ign} size="lg" />
              <div className="text-center sm:text-left flex-1 min-w-0">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-maroon text-white text-[10px] font-black tracking-widest uppercase mb-2 shadow-2xs">
                  <Crown className="w-3.5 h-3.5 text-gold" /> Team Captain
                </div>
                <h3 className="font-black text-stone-950 text-lg sm:text-xl tracking-wider leading-snug truncate">
                  {captain.ign}
                </h3>
                {captain.role && (
                  <p className="text-xs text-maroon font-black tracking-wider uppercase mt-0.5">
                    Role: {captain.role}
                  </p>
                )}
                {captain.name && (
                  <p className="text-xs text-stone-500 font-semibold mt-1">
                    {captain.name}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Official Players Roster Section */}
      <section className="animate-stagger-2 space-y-6 pt-4">
        <div className="flex items-center gap-3 pb-3 border-b border-stone-200/90">
          <div className="w-10 h-10 rounded-xl bg-maroon/10 border border-maroon/20 text-maroon grid place-items-center shadow-2xs">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-black text-stone-950 text-xl tracking-wider">Official Team Roster</h2>
            <p className="text-xs text-stone-500 font-medium tracking-wide mt-0.5">
              Active collegiate players representing {team.name}. Hover or tap a card to flip it.
            </p>
          </div>
        </div>

        {players.length === 0 ? (
          <EmptyNote>No players listed in this team yet.</EmptyNote>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,18rem),1fr))] gap-5 sm:gap-6">
            {/* Trading cards: hover, focus or tap to flip for the details */}
            {players.map((p) => (
              <PlayerTradingCard key={p.id} player={p} teamName={team.name} gameName={gameName} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
