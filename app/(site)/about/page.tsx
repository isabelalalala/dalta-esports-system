import { getSiteContent } from '@/utils/site-data';
import { siteImageUrl } from '@/utils/site';
import PageHeroBackground from '@/components/site/PageHeroBackground';

// About Us Page: Redesigned with custom container hierarchy
// 1. Large main container with DALTA Maroon brand color matching the logo (#5B271E), white text, centered
// 2. Full-width Our Story container (aligned with main container)
// 3. Side-by-side containers for Mission and Vision
// 4. Final signature Game With Purpose container
export const instant = false;

export default async function AboutPage() {
  'use cache';
  const content = await getSiteContent();

  const defaultIntro =
    'DALTA Esports is the official esports organization of the University of Perpetual Help System DALTA – Molino Campus. We bring students together to compete, grow and represent our school in MLBB, Valorant, Tekken 8, League of Legends and CODM.';

  const defaultStory =
    'Founded in February 2025, DALTA Esports began as a passionate grassroots movement among Perpetualite gamers who shared a common vision: to create an officially recognized, competitive, and supportive home for esports at the University of Perpetual Help System DALTA – Molino Campus.\n\nWhat started as student-organized scrims and casual tournaments has rapidly evolved into a structured collegiate organization spanning multiple flagship titles. Today, we train collegiate athletes, host campus championships, and cultivate student leadership in tournament broadcasting, team management, and creative media.';

  const defaultMission =
    'To foster an inclusive, disciplined, and high-performing collegiate esports ecosystem that empowers Perpetualite students to excel in competitive gaming, academic endeavors, leadership, and ethical sportsmanship.';

  const defaultVision =
    'To become a premier collegiate esports organization in the Philippines, recognized for producing championship-caliber athletes, setting standards in collegiate gaming excellence, and proudly representing the Perpetualite spirit nationwide.';

  const defaultCoreBelief =
    'At DALTA Esports, competition is more than just victory on the screen. We believe gaming is a powerful vehicle for character development, camaraderie, discipline, and community impact. Every match we play and event we organize is driven by dedication to our university, our teammates, and our passion.';

  return (
    <div className="w-full space-y-8 uppercase">
      {/* 1. Large Main Container with Dynamic Background Image from Site Text */}
      <section className="relative w-full rounded-3xl border border-stone-800/80 bg-stone-950 overflow-hidden shadow-md p-8 sm:p-14 lg:p-16 text-center text-white flex flex-col items-center justify-center space-y-4 animate-hero-entrance">
        <PageHeroBackground
          src={content.about_image_path ? (siteImageUrl(content.about_image_path) ?? undefined) : undefined}
          specificKey="about_image_path"
          alt="DALTA Esports About Us Banner"
        />

        <div className="relative z-10 max-w-4xl mx-auto space-y-3">
          <h1
            className="text-4xl sm:text-5xl lg:text-6xl font-black !text-white text-white tracking-wider uppercase leading-tight animate-hero-title"
            style={{ color: '#ffffff' }}
          >
            About Us
          </h1>
          <p
            className="text-base sm:text-lg !text-white text-stone-200 font-medium uppercase tracking-wide leading-relaxed animate-hero-tagline"
            style={{ color: '#ffffff' }}
          >
            {content.about_intro || defaultIntro}
          </p>
        </div>
      </section>

      {/* 2. Second Container: Our Story (Expanded full-width, aligned with main container) */}
      <section className="w-full rounded-3xl border border-stone-200/90 bg-white p-8 sm:p-12 shadow-xs space-y-4 animate-stagger-1">
        <div className="pb-3 border-b border-stone-100">
          <h2 className="text-xl sm:text-2xl font-black text-stone-950 tracking-wider uppercase">
            Our Story
          </h2>
        </div>
        <p className="text-sm sm:text-base text-stone-700 font-medium uppercase tracking-wide leading-relaxed whitespace-pre-wrap">
          {content.our_story || defaultStory}
        </p>
      </section>

      {/* 3. Two Containers Side-by-Side: Mission & Vision */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 animate-stagger-2">
        {/* Mission Container */}
        <section className="w-full rounded-2xl border border-stone-200/90 bg-white p-6 sm:p-8 shadow-xs hover:border-amber-500/30 hover:shadow-md transition-all space-y-3 flex flex-col justify-between">
          <div className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-black text-stone-950 tracking-wider uppercase">
              Mission
            </h2>
            <p className="text-xs sm:text-sm text-stone-700 font-medium uppercase tracking-wide leading-relaxed whitespace-pre-wrap">
              {content.mission || defaultMission}
            </p>
          </div>
        </section>

        {/* Vision Container */}
        <section className="w-full rounded-2xl border border-stone-200/90 bg-white p-6 sm:p-8 shadow-xs hover:border-amber-500/30 hover:shadow-md transition-all space-y-3 flex flex-col justify-between">
          <div className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-black text-stone-950 tracking-wider uppercase">
              Vision
            </h2>
            <p className="text-xs sm:text-sm text-stone-700 font-medium uppercase tracking-wide leading-relaxed whitespace-pre-wrap">
              {content.vision || defaultVision}
            </p>
          </div>
        </section>
      </div>

      {/* 4. Final Container: Game With Purpose */}
      <section className="w-full rounded-3xl border border-stone-200/90 bg-gradient-to-br from-amber-50/70 via-white to-stone-50 p-8 sm:p-12 lg:p-14 text-center space-y-4 shadow-xs animate-stagger-3">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-800 text-xs font-black uppercase tracking-widest shadow-2xs">
          Official Organization Motto
        </div>
        <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black text-stone-950 tracking-wider uppercase leading-tight">
          Game With <span className="text-amber-600">Purpose</span>
        </h2>
        <p className="text-xs sm:text-sm text-stone-700 max-w-3xl mx-auto font-medium uppercase tracking-wide leading-relaxed whitespace-pre-wrap">
          {content.core_belief_text || defaultCoreBelief}
        </p>
      </section>
    </div>
  );
}
