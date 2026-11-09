'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, Flame, Megaphone, Search, Trophy, Users, type LucideIcon } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

// Global search in the header. Typing shows grouped results right away (Tournaments, Teams,
// Events, Campaigns, Announcements); Enter or the button opens the full results page (/search),
// so it also works without JavaScript. Each query reads only what that visitor may see (RLS):
// logged-out visitors get tournaments, published events/campaigns and announcements; teams
// need a login.

interface Result { href: string; label: string; sub?: string }
interface Group { title: string; icon: LucideIcon; items: Result[] }

// ilike pattern with the user's % and _ taken literally
const pattern = (q: string) => `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;

async function searchAll(q: string): Promise<Group[]> {
  const supabase = createClient();
  const like = pattern(q);
  const { data: { session } } = await supabase.auth.getSession();
  const loggedIn = Boolean(session);

  const [tournaments, events, campaigns, teams, announcements] = await Promise.all([
    supabase.from('tournaments').select('id, name, game').ilike('name', like).order('start_date', { ascending: false }).limit(5),
    supabase.from('events').select('id, title, event_date').eq('is_published', true).ilike('title', like).limit(4),
    supabase.from('campaigns').select('id, title').eq('is_published', true).ilike('title', like).limit(4),
    loggedIn
      ? supabase.from('teams').select('id, name, games(name)').eq('is_removed', false).ilike('name', like).limit(5)
      : Promise.resolve({ data: [] as { id: string; name: string; games: { name: string } | null }[] }),
    // Published announcements are public (202611092000); drafts stay hidden by RLS
    supabase.from('announcements').select('id, title').eq('is_draft', false).ilike('title', like).order('publish_at', { ascending: false }).limit(4),
  ]);

  const groups: Group[] = [
    {
      title: 'Tournaments', icon: Trophy,
      items: (tournaments.data ?? []).map((t) => ({ href: loggedIn ? `/tournaments/${t.id}` : `/t/${t.id}`, label: t.name, sub: t.game ?? undefined })),
    },
    {
      title: 'Teams', icon: Users,
      items: ((teams.data ?? []) as unknown as { id: string; name: string; games: { name: string } | null }[])
        .map((t) => ({ href: `/teams/${t.id}`, label: t.name, sub: t.games?.name })),
    },
    { title: 'Events', icon: CalendarDays, items: (events.data ?? []).map((e) => ({ href: `/events/${e.id}`, label: e.title })) },
    { title: 'Campaigns', icon: Flame, items: (campaigns.data ?? []).map((c) => ({ href: `/campaigns/${c.id}`, label: c.title })) },
    { title: 'Announcements', icon: Megaphone, items: (announcements.data ?? []).map((a) => ({ href: `/announcements/${a.id}`, label: a.title })) },
  ];
  return groups.filter((g) => g.items.length > 0);
}

export default function SiteSearchBox({ defaultValue = '' }: { defaultValue?: string }) {
  const [q, setQ] = useState(defaultValue);
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLFormElement>(null);
  const listId = useId();

  // Search a moment after typing stops (2+ characters)
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      searchAll(term).then((g) => {
        if (!cancelled) setGroups(g);
      }).catch(() => {
        if (!cancelled) setGroups([]);
      });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q]);

  // Close on a click outside
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  const showPanel = open && q.trim().length >= 2 && groups !== null;

  return (
    <form
      ref={boxRef}
      action="/search"
      role="search"
      onKeyDown={(e) => {
        if (e.key === 'Escape') setOpen(false);
      }}
      className="relative flex items-center w-full h-11 rounded-xl border border-stone-200 bg-stone-50/90 hover:border-stone-300 focus-within:bg-surface focus-within:border-amber-600 focus-within:ring-2 focus-within:ring-amber-500/20 shadow-xs transition-all group"
    >
      <div className="pl-3.5 pr-1.5 flex items-center justify-center text-stone-500 group-focus-within:text-amber-600 transition-colors shrink-0">
        <Search className="w-4 h-4" aria-hidden="true" />
      </div>
      <input
        type="search"
        name="q"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        // Short so it never gets cut off on phones; the label says what it searches
        placeholder="Search…"
        aria-label="Search tournaments, teams, events and campaigns"
        role="combobox"
        aria-expanded={showPanel}
        aria-controls={listId}
        autoComplete="off"
        className="flex-1 min-w-0 h-full bg-transparent px-2 text-xs sm:text-sm text-stone-950 placeholder:text-stone-400 outline-none font-medium"
      />
      <button
        type="submit"
        className="h-full px-4 sm:px-5 rounded-r-xl bg-stone-950 hover:bg-amber-600 text-white font-extrabold text-xs uppercase tracking-wider transition-colors shrink-0 flex items-center justify-center"
      >
        Search
      </button>

      {showPanel && (
        <div
          id={listId}
          className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 max-h-[70vh] overflow-y-auto rounded-2xl border border-stone-200 bg-white p-2 shadow-xl"
        >
          {groups.length === 0 ? (
            <p className="px-3 py-4 text-sm text-stone-600">No results for “{q.trim()}”.</p>
          ) : (
            groups.map((g) => (
              <div key={g.title} className="py-1">
                <p className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-stone-500">
                  <g.icon className="size-3.5" aria-hidden="true" /> {g.title}
                </p>
                <ul>
                  {g.items.map((r) => (
                    <li key={`${g.title}-${r.href}-${r.label}`}>
                      <Link
                        href={r.href}
                        onClick={() => setOpen(false)}
                        className="flex min-h-11 items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm hover:bg-stone-100 focus-visible:bg-stone-100 outline-none"
                      >
                        <span className="min-w-0 truncate font-bold text-stone-950">{r.label}</span>
                        {r.sub && <span className="shrink-0 truncate text-xs text-stone-500">{r.sub}</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
          <Link
            href={`/search?q=${encodeURIComponent(q.trim())}`}
            onClick={() => setOpen(false)}
            className="mt-1 block rounded-xl px-3 py-2.5 text-center text-xs font-black uppercase tracking-wider text-maroon hover:bg-stone-100"
          >
            See all results →
          </Link>
        </div>
      )}
    </form>
  );
}
