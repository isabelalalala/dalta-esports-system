'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import { can } from '@/utils/permissions';
import { usePageTitle } from '@/utils/page-title';
import { parseSchema, type GameProfileSchema } from '@/utils/game-profiles';
import PageLoading from '@/components/PageLoading';
import PageError from '@/components/PageError';
import GameIcon from '@/components/GameIcon';
import PageHeroBackground from '@/components/site/PageHeroBackground';
import GameSchemaEditor from './GameSchemaEditor';

interface GameRow {
  id: string;
  name: string;
  schema: GameProfileSchema;
}

// /admin/games (admin): the fields and options of each game's profile form (ranks, roles,
// heroes/agents/champions, servers). Saved with update_game_profile_schema() (202611091400).
export default function GameProfilesAdminPage() {
  usePageTitle('Game profiles');
  const supabase = useMemo(() => createClient(), []);
  const [role, setRole] = useState('');
  const [games, setGames] = useState<GameRow[]>([]);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const { data: myRole, error: roleError } = await supabase.rpc('get_my_role');
        if (roleError) throw roleError;
        setRole(myRole ?? '');
        if (!can(myRole, 'games.editProfiles')) return;
        const { data, error } = await supabase.from('games').select('id, name, profile_schema').order('name');
        if (error) throw error;
        const rows = (data ?? []).map((g) => ({ id: g.id, name: g.name, schema: parseSchema(g.profile_schema) }));
        setGames(rows);
        setSelected(rows[0]?.id ?? '');
      } catch (err) {
        setLoadError(getErrorMessage(err, 'The game profiles could not be loaded.'));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [supabase]);

  if (loading) return <PageLoading />;
  if (loadError) return <PageError message={loadError} />;
  if (!can(role, 'games.editProfiles')) {
    return (
      <div className="p-10 text-center space-y-4">
        <p className="font-extrabold text-stone-900">Only administrators can edit game profile options.</p>
        <Link href="/dashboard" className="inline-block text-maroon font-bold underline">← Back to Dashboard</Link>
      </div>
    );
  }

  const game = games.find((g) => g.id === selected);

  return (
    <div className="w-full space-y-8">
      <section className="relative w-full rounded-3xl border border-stone-800/80 bg-stone-950 overflow-hidden shadow-md p-8 sm:p-12 text-center text-white flex flex-col items-center justify-center space-y-3">
        <PageHeroBackground specificKey="hero_banner_path" alt="DALTA Esports banner" />
        <div className="relative z-10 max-w-3xl mx-auto space-y-3">
          <h1 className="text-display font-black tracking-wider uppercase leading-tight text-white">Game Profiles</h1>
          <p className="text-base font-medium leading-relaxed text-white">
            The ranks, roles, heroes and other choices players pick from when they set up a game profile.
            Rename, reorder or add options here; no code changes needed.
          </p>
        </div>
      </section>

      <div role="tablist" aria-label="Game" className="flex flex-wrap gap-2">
        {games.map((g) => (
          <button
            key={g.id}
            type="button"
            role="tab"
            aria-selected={g.id === selected}
            onClick={() => setSelected(g.id)}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black uppercase tracking-wide cursor-pointer ${
              g.id === selected ? 'border-gold bg-gold/15 text-stone-950' : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300'
            }`}
          >
            <GameIcon name={g.name} gameId={g.id} size="xs" />
            {g.name}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-stone-200/90 bg-stone-50 p-4 text-sm text-stone-700 space-y-1">
        <p><strong className="text-stone-950">Renaming</strong> an option updates every profile that has it.</p>
        <p><strong className="text-stone-950">Rank lists</strong> go from lowest to highest: the order decides the badge color and the recruiting rank filter.</p>
        <p><strong className="text-stone-950">Removing</strong> an option keeps it on existing profiles until the player edits.</p>
      </div>

      {game && (
        <GameSchemaEditor
          key={game.id}
          gameId={game.id}
          gameName={game.name}
          initial={game.schema}
          onSaved={(schema) => setGames((list) => list.map((g) => (g.id === game.id ? { ...g, schema } : g)))}
        />
      )}
    </div>
  );
}
