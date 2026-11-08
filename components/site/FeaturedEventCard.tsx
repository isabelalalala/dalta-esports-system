import Image from 'next/image';
import Link from 'next/link';
import { Calendar, MapPin, Sparkles } from 'lucide-react';
import { formatDate } from '@/utils/tournaments';
import { siteImageUrl, type SitePost } from '@/utils/site';
import EventCountdown from './EventCountdown';

// The homepage's featured event (pinned by an admin, or the next upcoming one): a wide dark card
// with a gold border and glow, date (or "Date TBA"), venue, countdown and buttons.
export default function FeaturedEventCard({ event }: { event: SitePost }) {
  const image = siteImageUrl(event.image_path);
  const href = `/events/${event.id}`;

  return (
    <article className="relative overflow-hidden rounded-3xl border border-gold/70 bg-ink text-white shadow-xl shadow-gold/20 ring-1 ring-gold/30">
      <div className="absolute inset-0 bg-logo-stage pointer-events-none" aria-hidden="true" />
      <div className={`relative grid grid-cols-1 ${image ? '@3xl:grid-cols-2' : ''}`}>
        {image && (
          <Link href={href} className="group relative block aspect-video @3xl:aspect-auto @3xl:min-h-72 overflow-hidden" tabIndex={-1} aria-hidden="true">
            <Image
              src={image}
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover group-hover:scale-105 transition-transform duration-500"
            />
          </Link>
        )}

        <div className="p-6 sm:p-8 @5xl:p-10 flex flex-col justify-center gap-4 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gold px-3 py-1 text-[11px] font-black uppercase tracking-widest text-stone-950">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Upcoming
            </span>
            <span className="text-[11px] font-black uppercase tracking-widest text-stone-300">Featured event</span>
          </div>

          {/* text-white: headings otherwise take the page text color, which is dark inside this card */}
          <h3 className="text-2xl sm:text-3xl font-black uppercase tracking-wide leading-tight break-words text-white">
            <Link href={href} className="hover:text-gold transition-colors">{event.title}</Link>
          </h3>

          <ul className="space-y-1.5 text-sm font-bold text-stone-200">
            <li className="flex items-center gap-2">
              <Calendar className="h-4 w-4 shrink-0 text-gold" aria-hidden="true" />
              {event.event_date ? formatDate(event.event_date) : 'Date TBA'}
            </li>
            {event.venue && (
              <li className="flex items-center gap-2 min-w-0">
                <MapPin className="h-4 w-4 shrink-0 text-gold" aria-hidden="true" />
                <span className="break-words">{event.venue}</span>
              </li>
            )}
          </ul>

          {event.event_date && <EventCountdown eventDate={event.event_date} />}

          {event.description && (
            <p className="text-sm text-stone-300 font-medium line-clamp-3">{event.description}</p>
          )}

          <div className="flex flex-wrap gap-3 pt-1">
            <Link
              href={href}
              className="px-6 py-3 rounded-xl bg-gold text-stone-950 font-black text-xs sm:text-sm uppercase tracking-widest border border-amber-300 shadow-md hover:bg-golddark hover:-translate-y-0.5 transition-all duration-200"
            >
              View event
            </Link>
            {event.tournament_id && (
              <Link
                href={`/tournaments/${event.tournament_id}`}
                className="px-6 py-3 rounded-xl bg-white/10 text-white font-extrabold text-xs sm:text-sm uppercase tracking-widest border border-white/30 hover:bg-white/20 hover:border-white/50 hover:-translate-y-0.5 transition-all duration-200"
              >
                Register
              </Link>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
