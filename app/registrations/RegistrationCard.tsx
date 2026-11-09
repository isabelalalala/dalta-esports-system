'use client';

import Link from 'next/link';
import { CalendarDays, Clock, Swords } from 'lucide-react';
import type { RegistrationStatus } from '@/utils/types';
import { formatDate, formatDateTime } from '@/utils/tournaments';
import { REGISTRATION_STEPS } from '@/utils/registrations';
import GameIcon from '@/components/GameIcon';
import AvatarStack from '@/components/AvatarStack';
import StatusBadge, { type BadgeKind } from '@/components/StatusBadge';
import Celebrate from '@/components/Celebrate';
import GameBadge from '@/components/GameBadge';

export interface RegistrationCardData {
  id: string;
  tournamentId: string;
  tournamentName: string;
  gameName: string | null;
  gameId: string | null;
  startDate: string | null;
  // "Starts in 15 days" / "Ongoing" / "Completed" (utils/registrations.ts startsInText)
  whenText: string;
  teamName: string;
  isCaptain: boolean;
  status: RegistrationStatus;
  rejectionReason: string | null;
  roster: { name: string | null; avatar_url: string | null }[];
  nextMatch: { id: string; opponent: string; scheduledAt: string | null } | null;
  step: { current: number; stopped: boolean };
  // The captain can withdraw a pending registration before the deadline (the database rule)
  canWithdraw: boolean;
}

const STATUS_BADGE: Record<RegistrationStatus, BadgeKind> = {
  pending: 'pending',
  approved: 'approved',
  rejected: 'rejected',
  cancelled: 'withdrawn',
};

// One registration on /registrations. The tournament name is the card's link (its ::after covers
// the card); the buttons sit above it. Same hover lift, focus ring and equal heights as the team
// cards. Inside the card a container query switches between stacked (narrow) and side by side.
export default function RegistrationCard({
  reg, busy, onWithdraw,
}: {
  reg: RegistrationCardData;
  busy: boolean;
  onWithdraw: () => void;
}) {
  return (
    <article className="@container group card-interactive relative h-full rounded-3xl border border-stone-200/90 bg-white p-5 sm:p-6 shadow-xs has-[.card-link:focus-visible]:ring-4 has-[.card-link:focus-visible]:ring-gold/50">
      {/* First time you see this registration approved: a small celebration (once per device) */}
      {reg.status === 'approved' && (
        <Celebrate storageKey={`reg-approved:${reg.id}`} message={`${reg.teamName} is approved for ${reg.tournamentName}!`} />
      )}
      <div className="flex h-full flex-col gap-5 @md:flex-row">
        {/* Compact square game icon in a fixed-size box (the wide wordmark doesn't fit here) */}
        <GameIcon name={reg.gameName} gameId={reg.gameId} size="xl" />

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {/* Main info */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="min-w-0 text-lg sm:text-xl font-black uppercase tracking-wide leading-tight text-stone-950 break-words">
                <Link
                  href={`/tournaments/${reg.tournamentId}`}
                  className="card-link outline-none after:absolute after:inset-0 after:rounded-3xl after:content-[''] group-hover:text-maroon transition-colors"
                >
                  {reg.tournamentName}
                </Link>
              </h3>
              <StatusBadge kind={STATUS_BADGE[reg.status]} />
            </div>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-stone-600">
              <GameBadge name={reg.gameName} game={reg.gameId} size="xs" withName nameClassName="font-black text-maroon text-sm" />
              <span aria-hidden="true">·</span>
              <span className="font-black text-stone-900 break-words">{reg.teamName}</span>
              <StatusBadge kind={reg.isCaptain ? 'captain' : 'member'} />
            </p>
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-stone-600">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="size-4 text-stone-500" aria-hidden="true" /> {formatDate(reg.startDate)}
              </span>
              <span className="inline-flex items-center gap-1.5 font-black text-stone-900">
                <Clock className="size-4 text-maroon" aria-hidden="true" /> {reg.whenText}
              </span>
            </p>
            {reg.status === 'rejected' && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                <span className="font-black">Reason:</span> {reg.rejectionReason || 'No reason was given. Ask an organizer for details.'}
              </p>
            )}
          </div>

          {/* Progress: Registered → Approved → Check-in → Playing → Finished. Narrow cards (phones)
              show one "Step 2 of 5" line instead of five labels that wouldn't fit. */}
          <p className="@md:hidden -mb-2 text-xs font-black uppercase tracking-wider text-stone-700" aria-hidden="true">
            {reg.step.stopped
              ? 'Not in this tournament'
              : `Step ${reg.step.current + 1} of ${REGISTRATION_STEPS.length} · ${REGISTRATION_STEPS[reg.step.current]}`}
          </p>
          <ol className="grid grid-cols-5 gap-1" aria-label="Progress">
            {REGISTRATION_STEPS.map((label, i) => {
              const done = !reg.step.stopped && i < reg.step.current;
              const current = !reg.step.stopped && i === reg.step.current;
              return (
                <li key={label} className="flex flex-col items-center gap-1 text-center" aria-current={current ? 'step' : undefined}>
                  <span
                    className={`h-1.5 w-full rounded-full ${
                      current ? 'bg-gold' : done ? 'bg-maroon' : 'bg-stone-200'
                    }`}
                  />
                  <span className={`sr-only @md:not-sr-only text-[10px] font-black uppercase tracking-wide leading-tight ${current ? 'text-stone-950' : done ? 'text-maroon' : 'text-stone-500'}`}>
                    {label}
                  </span>
                </li>
              );
            })}
          </ol>

          {/* Next match + roster */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200/80 bg-stone-50/70 px-3.5 py-2.5">
            <div className="min-w-0 text-sm">
              <p className="text-[10px] font-black uppercase tracking-widest text-stone-500">Next match</p>
              {reg.nextMatch ? (
                <p className="flex flex-wrap items-center gap-x-2 font-bold text-stone-900">
                  <Swords className="size-4 text-maroon" aria-hidden="true" />
                  <span className="break-words">vs {reg.nextMatch.opponent}</span>
                  <span className="font-medium text-stone-600">{reg.nextMatch.scheduledAt ? formatDateTime(reg.nextMatch.scheduledAt) : 'Time TBA'}</span>
                </p>
              ) : (
                <p className="font-bold text-stone-600">Schedule TBA</p>
              )}
            </div>
            <AvatarStack people={reg.roster} />
          </div>

          {/* Actions: above the card link */}
          <div className="relative z-10 mt-auto flex flex-wrap gap-2">
            <Link href={`/tournaments/${reg.tournamentId}`} tabIndex={-1} className="btn btn-secondary">Tournament details</Link>
            <Link href={`/tournaments/${reg.tournamentId}#bracket`} className="btn btn-secondary">View bracket</Link>
            {reg.nextMatch && (
              <Link href={`/matches/${reg.nextMatch.id}`} className="btn btn-primary">Match page</Link>
            )}
            {reg.canWithdraw && (
              <button type="button" onClick={onWithdraw} disabled={busy} className="btn btn-danger">
                {busy ? 'Withdrawing...' : 'Withdraw'}
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
