'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { officerCategoryLabels, type OfficerCategory } from '@/utils/site';
import ListEditor, { type FieldConfig, type Row } from './ListEditor';
import SiteTextEditor from './SiteTextEditor';

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

// Edit the public website without code (admin only; RLS and the storage policies also check).
export default function WebsiteAdminPage() {
  const supabase = createClient();
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('Site text');
  const [games, setGames] = useState<{ value: string; label: string }[]>([]);
  const [tournaments, setTournaments] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data: myRole } = await supabase.rpc('get_my_role');
      setRole(myRole ?? '');
      if (myRole === 'admin') {
        const [gamesRes, toursRes] = await Promise.all([
          supabase.from('games').select('id, name').order('name'),
          supabase.from('tournaments').select('id, name').order('start_date', { ascending: false }),
        ]);
        setGames((gamesRes.data || []).map((g) => ({ value: g.id, label: g.name })));
        setTournaments((toursRes.data || []).map((t) => ({ value: t.id, label: t.name })));
      }
      setLoading(false);
    };
    load();
  }, [supabase]);

  if (loading) return <div className="min-h-screen bg-[#0a0a0c] text-white p-10 text-center">Loading...</div>;
  if (role !== 'admin') {
    return (
      <div className="min-h-screen bg-[#0a0a0c] text-white p-10 text-center">
        Only admins can edit the website.{' '}
        <Link href="/dashboard" className="text-[#00d2ff] underline">Back to Dashboard</Link>
      </div>
    );
  }

  const gameName = (id: unknown) => games.find((g) => g.value === id)?.label ?? str(id);

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white px-4 py-10">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <Link href="/dashboard" className="inline-block text-[#00d2ff] hover:underline mb-6">← Back to Dashboard</Link>
          <div className="flex flex-wrap justify-between items-center gap-4">
            <h1 className="text-4xl font-bold text-[#00d2ff]">Website</h1>
            <Link href="/" target="_blank" className="border border-[#00d2ff] text-[#00d2ff] px-4 py-2 rounded-lg font-bold hover:bg-[#00d2ff]/10">
              View website ↗
            </Link>
          </div>
          <p className="text-gray-400 text-sm mt-2">
            Changes appear on the public website as soon as you save. Hidden items stay saved but aren&apos;t shown.
          </p>
        </div>

        <div className="flex flex-wrap gap-2" role="tablist">
          {TABS.map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg font-bold border ${tab === t
                ? 'bg-[#00d2ff] text-black border-[#00d2ff]' : 'border-[#00d2ff]/40 text-gray-300 hover:bg-[#00d2ff]/10'}`}>
              {t}
            </button>
          ))}
        </div>

        {/* key: switching tabs starts each editor fresh */}
        <div key={tab}>
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
  const supabase = createClient();

  // Only one captain per team (the database also enforces it): clear the others first
  const oneCaptain = async (player: Row) => {
    if (!player.is_captain) return;
    const { error } = await supabase
      .from('official_team_players')
      .update({ is_captain: false })
      .eq('team_id', teamId)
      .neq('id', str(player.id));
    if (error) throw error;
  };

  return (
    <div className="border-t border-gray-700 pt-4 space-y-3">
      <h4 className="font-bold">Players</h4>
      <p className="text-xs text-gray-400">Shown as &quot;IGN – role&quot;. Players appear on the website when the team is published.</p>
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
