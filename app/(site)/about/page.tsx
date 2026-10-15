import Image from 'next/image';
import { getSiteContent } from '@/utils/site-data';
import { siteImageUrl } from '@/utils/site';
import { PageTitle, Paragraphs, SectionTitle, SiteBox } from '@/components/site/SiteParts';

// About Us (wireframe: founded February 2025, Our Story, Mission, Vision, "Game With Purpose")
export default async function AboutPage() {
  const content = await getSiteContent();
  const image = siteImageUrl(content.about_image_path);

  return (
    <div className="space-y-8">
      <PageTitle title="About Us" subtitle={content.founded ? `Founded ${content.founded}` : undefined} />

      <SiteBox className="space-y-4">
        {image && (
          <div className="relative aspect-video border-2 border-brownlight overflow-hidden">
            <Image src={image} alt="DALTA Esports" fill unoptimized className="object-cover" />
          </div>
        )}
        <Paragraphs text={content.about_intro} />
      </SiteBox>

      <SiteBox>
        <SectionTitle>Our Story</SectionTitle>
        <Paragraphs text={content.our_story} />
      </SiteBox>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SiteBox>
          <SectionTitle>Mission</SectionTitle>
          <Paragraphs text={content.mission} />
        </SiteBox>
        <SiteBox>
          <SectionTitle>Vision</SectionTitle>
          <Paragraphs text={content.vision} />
        </SiteBox>
      </div>

      <section className="border-2 border-gold bg-brown/40 p-8 text-center space-y-4 shadow-[6px_6px_0_var(--color-brown)]">
        <p className="text-xs uppercase tracking-widest text-gray-400">Our core belief</p>
        <h2 className="font-pixel text-gold text-lg sm:text-2xl leading-relaxed">{content.core_belief_title}</h2>
        {content.core_belief_text && <p className="text-gray-300 max-w-2xl mx-auto">{content.core_belief_text}</p>}
      </section>
    </div>
  );
}
