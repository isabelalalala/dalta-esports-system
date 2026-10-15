import { facebookEmbedUrl } from '@/utils/streams';

// Facebook's embedded video player, 16:9 and full width (also on phones).
// Some ad blockers hide Facebook embeds, so there is always a direct link below it.
export default function FacebookPlayer({ url, title }: { url: string; title: string }) {
  return (
    <div>
      <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
        <iframe
          src={facebookEmbedUrl(url)}
          title={title}
          className="absolute inset-0 w-full h-full border-0"
          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
      <p className="mt-2 text-sm text-gray-400">
        Video not showing? It must be set to Public on Facebook, and some ad blockers hide it.{' '}
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-[#00d2ff] underline">
          Open on Facebook
        </a>
      </p>
    </div>
  );
}
