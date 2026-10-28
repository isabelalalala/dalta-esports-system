import { facebookEmbedUrl } from '@/utils/streams';

// Facebook's embedded video player, 16:9 and full width (also on phones).
// Some ad blockers hide Facebook embeds, so there is always a direct link below it.
export default function FacebookPlayer({ url, title }: { url: string; title: string }) {
  return (
    <div>
      <div className="relative w-full aspect-video bg-black overflow-hidden">
        <iframe
          src={facebookEmbedUrl(url)}
          title={title}
          loading="lazy"
          className="absolute inset-0 w-full h-full border-0"
          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
      <p className="mt-2 text-xs font-semibold text-stone-500 uppercase tracking-wider">
        Video not displaying? Stream must be set to Public on Facebook.{' '}
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-[#5B271E] font-black underline hover:text-[#FFCC37]">
          Open on Facebook ↗
        </a>
      </p>
    </div>
  );
}
