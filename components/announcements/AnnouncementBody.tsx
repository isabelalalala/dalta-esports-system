import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import FacebookPlayer from '@/components/FacebookPlayer';
import { parseInline, parseRichText, type InlineToken } from '@/utils/announcements';

// Renders the announcement body format (utils/announcements.ts parseRichText) as React elements.
// Nothing is inserted as HTML, so a post can't contain scripts; links are limited to our pages and
// https, images to our own bucket, videos to Facebook.
export default function AnnouncementBody({ body, title }: { body: string; title: string }) {
  const blocks = parseRichText(body);
  return (
    <div className="max-w-prose space-y-5 text-base leading-relaxed text-stone-800">
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'heading':
            return block.level === 2 ? (
              <h2 key={i} className="pt-2 text-xl sm:text-2xl font-black tracking-tight text-stone-950">{inline(block.text)}</h2>
            ) : (
              <h3 key={i} className="pt-1 text-lg font-black tracking-tight text-stone-950">{inline(block.text)}</h3>
            );
          case 'paragraph':
            return <p key={i} className="break-words">{inline(block.text)}</p>;
          case 'quote':
            return (
              <blockquote key={i} className="border-l-4 border-gold bg-gold/10 rounded-r-xl px-4 py-3 font-semibold text-stone-900">
                {inline(block.text)}
              </blockquote>
            );
          case 'list': {
            const List = block.ordered ? 'ol' : 'ul';
            return (
              <List key={i} className={`space-y-1.5 pl-6 marker:font-black marker:text-maroon ${block.ordered ? 'list-decimal' : 'list-disc'}`}>
                {block.items.map((item, j) => <li key={j} className="break-words pl-1">{inline(item)}</li>)}
              </List>
            );
          }
          case 'image':
            return (
              <figure key={i} className="space-y-2">
                <span className="relative block aspect-video overflow-hidden rounded-2xl border border-stone-200/90 bg-stone-100">
                  <Image src={block.src} alt={block.alt} fill sizes="(min-width: 1024px) 65ch, 100vw" className="object-contain" />
                </span>
                {block.alt && <figcaption className="text-center text-xs font-semibold text-stone-600">{block.alt}</figcaption>}
              </figure>
            );
          case 'video':
            return (
              <div key={i} className="overflow-hidden rounded-2xl">
                <FacebookPlayer url={block.url} title={title} />
              </div>
            );
        }
      })}
    </div>
  );
}

function inline(text: string): ReactNode {
  return render(parseInline(text));
}

function render(tokens: InlineToken[]): ReactNode {
  return tokens.map((t, i) => {
    switch (t.type) {
      case 'text': return t.text;
      case 'break': return <br key={i} />;
      case 'bold': return <strong key={i} className="font-black text-stone-950">{render(t.children)}</strong>;
      case 'italic': return <em key={i}>{render(t.children)}</em>;
      case 'link':
        return t.href.startsWith('/') ? (
          <Link key={i} href={t.href} className="font-bold text-maroon underline underline-offset-2 hover:text-maroondark">{render(t.children)}</Link>
        ) : (
          <a key={i} href={t.href} target="_blank" rel="noopener noreferrer nofollow" className="font-bold text-maroon underline underline-offset-2 hover:text-maroondark break-all">
            {render(t.children)}
          </a>
        );
    }
  });
}
