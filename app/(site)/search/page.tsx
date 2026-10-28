import { Suspense, type ReactNode } from 'react';
import Link from 'next/link';
import { createPublicClient } from '@/utils/supabase/public';
import { formatDate, getTournamentStatus, statusLabels } from '@/utils/tournaments';
import type { SitePost } from '@/utils/site';
import type { Tournament } from '@/utils/types';
import SiteSearchBox from '@/components/site/SiteSearchBox';
import { EmptyNote, PageTitle, SectionTitle } from '@/components/site/SiteParts';
import { SectionLoading } from '@/components/PageLoading';

const LIMIT = 20;

// Search: tournaments, events and campaigns (only what logged-out visitors may see).
// The query comes from the URL, so the results are inside Suspense.
export default function SearchPage({ searchParams }: PageProps<'/search'>) {
  return (
    <div className="w-full uppercase">
      <PageTitle title="Search" />
      <Suspense fallback={<SectionLoading label="Searching..." />}>
        <SearchResults searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function SearchResults({ searchParams }: { searchParams: PageProps<'/search'>['searchParams'] }) {
  const raw = (await searchParams).q;
  const query = (Array.isArray(raw) ? raw[0] : raw ?? '').trim().slice(0, 100);
  // Characters with a special meaning in the database filter are removed
  const term = query.replace(/[%_,()*\\]/g, ' ').trim();

  if (!term) {
    return (
      <div className="space-y-4">
        <SiteSearchBox />
        <p className="text-stone-500 text-xs sm:text-sm font-semibold uppercase tracking-wider">Type a tournament, event or campaign name.</p>
      </div>
    );
  }

  const supabase = createPublicClient();
  const pattern = `%${term}%`;
  const [tournamentsRes, eventsRes, campaignsRes] = await Promise.all([
    supabase.from('tournaments')
      .select('id, name, game, status, start_date, end_date, registration_deadline')
      .or(`name.ilike.${pattern},game.ilike.${pattern}`)
      .order('start_date', { ascending: false })
      .limit(LIMIT),
    supabase.from('events').select('*').or(`title.ilike.${pattern},description.ilike.${pattern}`).limit(LIMIT),
    supabase.from('campaigns').select('*').or(`title.ilike.${pattern},description.ilike.${pattern}`).limit(LIMIT),
  ]);

  const tournaments = (tournamentsRes.data ?? []) as Pick<
    Tournament, 'id' | 'name' | 'game' | 'status' | 'start_date' | 'end_date' | 'registration_deadline'
  >[];
  const events = (eventsRes.data ?? []) as SitePost[];
  const campaigns = (campaignsRes.data ?? []) as SitePost[];
  const total = tournaments.length + events.length + campaigns.length;

  return (
    <div className="space-y-10">
      <div className="space-y-2">
        <SiteSearchBox defaultValue={query} />
        <p className="text-stone-600 text-xs sm:text-sm font-semibold uppercase tracking-wider">
          {total === 0 ? 'No results' : `${total} result${total === 1 ? '' : 's'}`} for &quot;{query}&quot;
        </p>
      </div>

      {total === 0 && <EmptyNote>Nothing matched. Try a game name like &quot;MLBB&quot; or part of a title.</EmptyNote>}

      {tournaments.length > 0 && (
        <section>
          <SectionTitle>Tournaments</SectionTitle>
          <ResultList>
            {tournaments.map((t) => (
              <ResultItem key={t.id} href={`/t/${t.id}`} title={t.name}
                meta={`${t.game} · ${statusLabels[getTournamentStatus(t)]} · ${formatDate(t.start_date)}`} />
            ))}
          </ResultList>
        </section>
      )}

      {events.length > 0 && (
        <section>
          <SectionTitle>Events</SectionTitle>
          <ResultList>
            {events.map((e) => (
              <ResultItem key={e.id} href={`/events/${e.id}`} title={e.title}
                meta={e.event_date ? formatDate(e.event_date) : undefined} text={e.description} />
            ))}
          </ResultList>
        </section>
      )}

      {campaigns.length > 0 && (
        <section>
          <SectionTitle>Campaigns</SectionTitle>
          <ResultList>
            {campaigns.map((c) => (
              <ResultItem key={c.id} href={`/campaigns/${c.id}`} title={c.title}
                meta={c.event_date ? formatDate(c.event_date) : undefined} text={c.description} />
            ))}
          </ResultList>
        </section>
      )}
    </div>
  );
}

function ResultList({ children }: { children: ReactNode }) {
  return <ul className="rounded-2xl border border-stone-200/90 bg-white shadow-xs divide-y divide-stone-100 overflow-hidden">{children}</ul>;
}

function ResultItem({ href, title, meta, text }: { href: string; title: string; meta?: string; text?: string }) {
  return (
    <li>
      <Link href={href} className="block px-5 py-4 hover:bg-amber-50/50 transition-colors group">
        <p className="font-black text-stone-950 uppercase tracking-wide group-hover:text-amber-700 transition-colors">{title}</p>
        {meta && <p className="text-xs text-amber-700 font-extrabold uppercase tracking-wider mt-0.5">{meta}</p>}
        {text && <p className="text-xs sm:text-sm text-stone-600 font-medium uppercase tracking-wide line-clamp-2 mt-1">{text}</p>}
      </Link>
    </li>
  );
}
