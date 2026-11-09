import RankBadge from '@/components/RankBadge';
import type { Game, PlayerGameProfile } from '@/utils/types';
import { fieldFor, multiLabels, optionOf, parseDetails, parseSchema, selectLabel } from '@/utils/game-profiles';

// One saved game profile in a line or two: IGN, rank badge, main role, then the other picks
// (agents, champions, server...). Profiles saved before the new form show their old text.
export default function GameProfileSummary({ game, profile }: { game: Game; profile: PlayerGameProfile }) {
  const schema = parseSchema(game.profile_schema);
  const details = parseDetails(profile.details);
  const rankField = fieldFor(schema, 'rank');
  const position = rankField ? (rankField.options?.findIndex((o) => o.id === details[rankField.key]) ?? -1) + 1 : 0;

  // Everything that isn't the IGN, rank or role, as "Label: value"
  const extras = schema.fields
    .filter((f) => !f.maps_to && details[f.key] !== undefined && f.key !== 'user_id' && f.key !== 'zone_id' && f.key !== 'uid' && f.key !== 'tekken_id')
    .map((f) => {
      const value =
        f.type === 'multiselect' ? multiLabels(f, details[f.key]).join(', ')
        : f.type === 'select' ? (selectLabel(f, details) ?? optionOf(f, details[f.key])?.label ?? '')
        : String(details[f.key]);
      return value ? `${f.label}: ${value}` : '';
    })
    .filter(Boolean);

  return (
    <div className="mt-0.5 space-y-1 min-w-0">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm font-semibold text-stone-700">
        <span className="text-stone-950 font-black break-all">{profile.ign}</span>
        <RankBadge rank={profile.rank} position={position || null} count={rankField?.options?.length ?? null} />
        {profile.in_game_role && <span className="text-maroon font-extrabold">{profile.in_game_role}</span>}
      </p>
      {extras.length > 0 && <p className="text-xs text-stone-600 font-medium break-words">{extras.join(' · ')}</p>}
      {Object.keys(details).length === 0 && (
        <p className="text-xs font-semibold text-maroon">Update this profile to add your {game.name} details.</p>
      )}
    </div>
  );
}
