'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { officerCategoryLabels, type OfficerCategory } from '@/utils/site';
import ListEditor, { type FieldConfig, type Row } from './ListEditor';
import SiteTextEditor from './SiteTextEditor';
import PageLoading from '@/components/PageLoading';
import PageError from '@/components/PageError';
import { getErrorMessage } from '@/utils/errors';
import { usePageTitle } from '@/utils/page-title';
import PageHeroBackground from '@/components/site/PageHeroBackground';

const TABS = ['Site text', 'Carousel', 'Campaigns', 'Events', 'Divisions', 'Officers', 'Official teams'] as const;
type Tab = (typeof TABS)[number];

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));

// Fields shared by campaigns and events
const postFields: FieldConfig[] = [
  { name: 'title', label: 'Title', type: 'text', required: true },
  { name: 'event_date', label: 'Date', type: 'date' },
  { name: 'description', label: 'Description', type: 'textarea' },
  { name: 'image_path', label: 'Image', type: 'image' },
  { name: 'link', label: 'Link (optional)', type: 'link', help: 'A page on this site (/tournaments) or https://...' },
];

export default function WebsiteAdminPage() {
  const supabase = createClient();
  usePageTitle('Edit website');
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState<Tab>('Site text');
  const [games, setGames] = useState<{ value: string; label: string }[]>([]);
  const [tournaments, setTournaments] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: myRole, error: roleError } = await supabase.rpc('get_my_role');
        if (roleError) throw roleError;
        setRole(myRole ?? '');
        if (myRole === 'admin') {
          const [gamesRes, toursRes] = await Promise.all([
            supabase.from('games').select('id, name').order('name'),
            supabase.from('tournaments').select('id, name').order('start_date', { ascending: false }),
          ]);
          if (gamesRes.error) throw gamesRes.error;
          if (toursRes.error) throw toursRes.error;
          setGames((gamesRes.data || []).map((g) => ({ value: g.id, label: g.name })));
          setTournaments((toursRes.data || []).map((t) => ({ value: t.id, label: t.name })));
        }
      } catch (err) {
        setLoadError(getErrorMessage(err, 'Failed to load the website editor'));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [supabase]);

  if (loading) return <PageLoading />;
  if (loadError) return <PageError message={loadError} />;
  if (role !== 'admin') {
    return (
      <div className="w-full bg-white text-stone-950 p-10 text-center uppercase space-y-4">
        <p className="font-extrabold text-stone-900">Only administrators can edit the website.</p>
        <Link href="/dashboard" className="inline-block text-amber-700 hover:text-amber-800 font-bold underline">
          ← Back to Dashboard
        </Link>
      </div>
    );
  }

  const gameName = (id: unknown) => games.find((g) => g.value === id)?.label ?? str(id);

  return (
    <div className="w-full space-y-8 uppercase">
      {/* 1. Main Hero Container with Official Banner */}
      <section className="relative w-full rounded-3xl border border-stone-800/80 bg-stone-950 overflow-hidden shadow-md p-8 sm:p-14 lg:p-16 text-center text-white flex flex-col items-center justify-center space-y-4">
        <PageHeroBackground specificKey="hero_banner_path" alt="DALTA Esports Website Banner" />

        <div className="relative z-10 w-full flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-black text-amber-400 hover:text-amber-300 uppercase tracking-wider transition-colors"
          >
            ← Back to Dashboard
          </Link>
          <Link
            href="/"
            target="_blank"
            className="inline-flex items-center gap-1.5 text-xs font-black bg-white/10 hover:bg-white/20 border border-white/20 text-white px-4 py-2 rounded-xl transition-all"
          >
            View Live Website ↗
          </Link>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto space-y-3 pt-2">
          <h1
            className="text-3xl sm:text-4xl lg:text-5xl font-black !text-white text-white tracking-wider uppercase leading-tight"
            style={{ color: '#ffffff' }}
          >
            Website Content
          </h1>
          <p
            className="text-base sm:text-lg !text-white text-stone-200 font-medium uppercase tracking-wide leading-relaxed"
            style={{ color: '#ffffff' }}
          >
            Edit public portal text, banners, campaigns, events, divisions, and officer rosters.
          </p>
        </div>
      </section>

      {/* 2. Tabs Strip & Editor Containers */}
      <div className="space-y-6 text-stone-950">
        <div className="flex flex-wrap gap-2 pb-2 border-b border-stone-200/80" role="tablist">
          {TABS.map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer ${
                tab === t
                  ? 'bg-amber-500/15 text-stone-950 border border-amber-500/30 shadow-2xs'
                  : 'text-stone-700 hover:text-stone-950 hover:bg-stone-100/80 border border-transparent'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Tab Contents */}
        <div key={tab} className="w-full">
          {tab === 'Site text' && <SiteTextEditor />}

          {tab === 'Carousel' && (
            <ListEditor
              table="hero_images"
              imageFolder="carousel"
              addWithImage="image_path"
              fields={[
                { name: 'image_path', label: 'Photo', type: 'image', required: true },
                { name: 'caption', label: 'Caption', type: 'text' },
                { name: 'link', label: 'Link (optional)', type: 'link', help: 'Where clicking the photo goes' },
              ]}
              titleOf={(r) => str(r.caption) || 'Photo without caption'}
            />
          )}

          {tab === 'Campaigns' && (
            <ListEditor
              table="campaigns"
              imageFolder="campaigns"
              newRow={{ title: 'New campaign', is_published: false }}
              fields={postFields}
              titleOf={(r) => str(r.title)}
              subtitleOf={(r) => str(r.event_date)}
              viewHref={(r) => `/campaigns/${r.id}`}
            />
          )}

          {tab === 'Events' && (
            <ListEditor
              table="events"
              imageFolder="events"
              newRow={{ title: 'New event', is_published: false }}
              fields={[
                ...postFields,
                { name: 'tournament_id', label: 'Tournament (optional)', type: 'select', options: tournaments },
              ]}
              titleOf={(r) => str(r.title)}
              subtitleOf={(r) => str(r.event_date)}
              viewHref={(r) => `/events/${r.id}`}
            />
          )}

          {tab === 'Divisions' && (
            <ListEditor
              table="game_divisions"
              idKey="game_id"
              imageFolder="divisions"
              canDelete={false}
              fields={[
                { name: 'tagline', label: 'Tagline', type: 'text' },
                { name: 'description', label: 'Description', type: 'textarea' },
                { name: 'image_path', label: 'Banner image', type: 'image' },
              ]}
              titleOf={(r) => gameName(r.game_id)}
              subtitleOf={(r) => str(r.tagline)}
              viewHref={(r) => `/divisions/${r.game_id}`}
            />
          )}

          {tab === 'Officers' && (
            <ListEditor
              table="officers"
              imageFolder="officers"
              newRow={{ name: 'New person', category: 'committee', is_published: false }}
              fields={[
                { name: 'name', label: 'Name', type: 'text', required: true },
                { name: 'position', label: 'Position', type: 'text', help: 'e.g. VP Internal, MLBB Head Coach' },
                {
                  name: 'category', label: 'Section on the Community page', type: 'select', required: true,
                  options: (Object.keys(officerCategoryLabels) as OfficerCategory[])
                    .map((c) => ({ value: c, label: officerCategoryLabels[c] })),
                },
                { name: 'game_id', label: 'Game (division heads and coaches)', type: 'select', options: games },
                { name: 'photo_path', label: 'Photo', type: 'image' },
              ]}
              titleOf={(r) => str(r.name)}
              subtitleOf={(r) => [r.position, officerCategoryLabels[r.category as OfficerCategory]].filter(Boolean).join(' · ')}
            />
          )}

          {tab === 'Official teams' && games.length > 0 && (
            <ListEditor
              table="official_teams"
              imageFolder="teams"
              newRow={{ name: 'New team', game_id: games[0].value, is_published: false }}
              fields={[
                { name: 'name', label: 'Team name', type: 'text', required: true },
                { name: 'subname', label: 'Subname', type: 'text', help: 'e.g. DALTA Esports Blaze' },
                { name: 'game_id', label: 'Game', type: 'select', required: true, options: games },
                { name: 'description', label: 'Description', type: 'textarea' },
                { name: 'photo_path', label: 'Team photo', type: 'image' },
              ]}
              titleOf={(r) => str(r.name)}
              subtitleOf={(r) => [gameName(r.game_id), r.subname].filter(Boolean).join(' · ')}
              viewHref={(r) => `/divisions/${r.game_id}/${r.id}`}
              renderExtra={(team) => <TeamPlayers teamId={str(team.id)} />}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// Players of one official team (shown while editing the team)
function TeamPlayers({ teamId }: { teamId: string }) {
  const oneCaptain = async (player: Row) => {
    if (!player.is_captain) return;
    const supabase = createClient();
    const { error } = await supabase
      .from('official_team_players')
      .update({ is_captain: false })
      .eq('team_id', teamId)
      .neq('id', str(player.id));
    if (error) throw error;
  };

  return (
    <div className="border-t border-stone-200/80 pt-5 space-y-3 text-stone-950">
      <h4 className="font-black text-stone-950 text-sm tracking-wider uppercase">Team Roster Players</h4>
      <p className="text-xs text-stone-500 font-semibold tracking-wide">
        Players appear on the public division page once the team is published.
      </p>
      <ListEditor
        table="official_team_players"
        filter={{ column: 'team_id', value: teamId }}
        imageFolder="players"
        hasPublish={false}
        newRow={{ ign: 'New player' }}
        beforeSave={oneCaptain}
        fields={[
          { name: 'ign', label: 'IGN', type: 'text', required: true },
          { name: 'role', label: 'In-game role', type: 'text', help: 'e.g. Jungler, Duelist' },
          { name: 'name', label: 'Real name (optional)', type: 'text' },
          { name: 'is_captain', label: 'Captain', type: 'checkbox' },
          { name: 'photo_path', label: 'Photo', type: 'image' },
        ]}
        titleOf={(r) => `${str(r.ign)}${r.is_captain ? ' (Captain)' : ''}`}
        subtitleOf={(r) => [r.role, r.name].filter(Boolean).join(' · ')}
      />
    </div>
  );
}
