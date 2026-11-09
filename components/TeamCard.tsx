'use client';

import Link from 'next/link';
import { ArrowRight, Check, Search, Users } from 'lucide-react';
import type { TeamListEntry } from '@/utils/types';
import { parseSchema } from '@/utils/game-profiles';
import { joinAction, lookingForText, teamBadges, teamSlots } from '@/utils/team-cards';
import TeamLogo from '@/components/TeamLogo';
import GameLogo from '@/components/GameLogo';
import Avatar from '@/components/Avatar';
import AvatarStack from '@/components/AvatarStack';
import StatusBadge from '@/components/StatusBadge';
import AnimatedProgress from '@/components/AnimatedProgress';
import AskToJoin from '@/components/AskToJoin';

export interface TeamCardViewer {
  // Only players can ask to join (spectators and organizers see View Team only)
  isPlayer: boolean;
  // Games I have a game profile for, and games I already have a team for (one team per game)
  profileGameIds: string[];
  myGameIds: string[];
  // My open join requests: team id -> request id (to cancel one)
  myRequests: Record<string, string>;
}

// One team in "All teams" / "My teams" (rows from list_teams()). The whole card opens the team
// page: the team name is the link and its ::after covers the card, while the buttons sit above it
// (z-10) so they still work. Hover lifts the card (card-interactive) and keyboard focus on the
// link draws a ring around the whole card. Cards in a grid row stretch to the same height.
export default function TeamCard({
  team: t, profileSchema, viewer, onChanged,
}: {
  team: TeamListEntry;
  // The game's profile form (games.profile_schema), for the "Looking for" labels
  profileSchema: unknown;
  viewer: TeamCardViewer;
  onChanged: () => void;
}) {
  const slots = teamSlots(t.member_count, t.max_players);
  const badges = teamBadges(t);
  const requestId = viewer.myRequests[t.id] ?? null;
  const action = joinAction({ ...t, my_request: requestId ?? t.my_request }, viewer);
  const lookingFor = t.recruiting && !slots.full ? lookingForText(parseSchema(profileSchema), t.looking_for) : '';
  const members = t.member_avatars ?? [];

  return (
    <article className="group card-interactive relative flex h-full flex-col gap-4 rounded-3xl border border-stone-200/90 bg-white p-5 sm:p-6 shadow-xs has-[.card-link:focus-visible]:ring-4 has-[.card-link:focus-visible]:ring-gold/50">
      {/* Header: logo, name, game */}
      <div className="flex items-start gap-3.5 min-w-0">
        <TeamLogo url={t.logo_url} name={t.name} gameId={t.game_id} gameName={t.game_name} />
        <div className="min-w-0 flex-1 space-y-1.5">
          <h3 className="text-base sm:text-lg font-black uppercase tracking-wide text-stone-950 break-words leading-tight">
            <Link
              href={`/teams/${t.id}`}
              className="card-link outline-none after:absolute after:inset-0 after:rounded-3xl after:content-[''] group-hover:text-maroon transition-colors"
            >
              {t.name}
            </Link>
          </h3>
          {/* Small game logo badge (the name is read out for screen readers) */}
          <span className="inline-flex items-center gap-2">
            <span className="relative block h-6 w-20 overflow-hidden rounded-md bg-ink" aria-hidden="true">
              <GameLogo name={t.game_name} gameId={t.game_id} balanced className="absolute inset-0" fallbackClassName="text-[10px]" sizes="80px" />
            </span>
            <span className="sr-only">{t.game_name}</span>
          </span>
        </div>
      </div>

      {badges.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {badges.map((b) => <StatusBadge key={b} kind={b} />)}
        </div>
      )}

      {t.description?.trim() && (
        <p className="line-clamp-2 break-words text-sm text-stone-600 font-medium">{t.description}</p>
      )}

      {lookingFor && (
        <p className="flex items-start gap-1.5 text-sm text-stone-800">
          <Search className="mt-0.5 size-4 shrink-0 text-maroon" aria-hidden="true" />
          <span><span className="font-black">Looking for:</span> {lookingFor}</span>
        </p>
      )}

      {/* Roster: avatars + slots */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <AvatarStack people={members} total={t.member_count} />
          <span className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-wider text-stone-600">
            <Users className="size-3.5" aria-hidden="true" /> {slots.label}
          </span>
        </div>
        {!slots.solo && (
          <AnimatedProgress
            value={Math.min(t.member_count, t.max_players)}
            max={Math.max(t.max_players, 1)}
            label={`${t.member_count} of ${t.max_players} roster slots filled`}
            className={`block h-1.5 w-full appearance-none overflow-hidden rounded-full bg-stone-200 [&::-webkit-progress-bar]:bg-stone-200 ${
              slots.full
                ? '[&::-webkit-progress-value]:bg-stone-500 [&::-moz-progress-bar]:bg-stone-500'
                : '[&::-webkit-progress-value]:bg-emerald-600 [&::-moz-progress-bar]:bg-emerald-600'
            }`}
          />
        )}
      </div>

      {/* Captain */}
      <div className="flex items-center gap-2 min-w-0 text-sm">
        <Avatar url={t.captain_avatar} name={t.captain_name} size="xs" />
        <span className="min-w-0 truncate font-bold text-stone-900">{t.captain_name || 'Unknown'}</span>
        <span className="shrink-0 text-[10px] font-black uppercase tracking-wider text-stone-500">Captain</span>
      </div>

      {/* Actions: above the card link (z-10) */}
      <div className="relative z-10 mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-4">
        <Link href={`/teams/${t.id}`} tabIndex={-1} className="btn btn-secondary">
          View team <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
        {action === 'request' && (
          <AskToJoin teamId={t.id} requestId={null} onChanged={onChanged} compact label="Request to join" />
        )}
        {action === 'requested' && requestId && (
          <AskToJoin teamId={t.id} requestId={requestId} onChanged={onChanged} compact sentLabel="Requested" />
        )}
        {action === 'member' && (
          <span className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-wider text-maroon">
            <Check className="size-4" aria-hidden="true" /> Member
          </span>
        )}
        {action === 'full' && (
          <span className="text-xs font-black uppercase tracking-wider text-stone-500">Full</span>
        )}
        {action === 'no-profile' && (
          <Link href="/profile" className="text-xs font-bold text-stone-600 underline hover:text-maroon">
            Add a {t.game_name} profile to join
          </Link>
        )}
      </div>
    </article>
  );
}
