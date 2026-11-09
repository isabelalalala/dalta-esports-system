'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, CalendarDays, ClipboardPen, MapPin, PlayCircle, Radio, Trophy, Users } from 'lucide-react';
import type { AnnouncementLink, LinkTeam } from '@/utils/announcements';
import { useViewer } from '@/utils/use-viewer';
import { can } from '@/utils/permissions';
import {
  formatDate, formatDateTime, getTournamentStatus, registrationClosesAt, statusLabels,
} from '@/utils/tournaments';
import { eventStartsAt, siteImageUrl } from '@/utils/site';
import { publicMatchPath, publicTournamentPath } from '@/utils/site-url';
import { smallActionClass, smallActionPrimaryClass } from '@/utils/button-styles';
import Countdown from '@/components/site/Countdown';
import CalendarLinks from '@/components/CalendarLinks';
import GameIcon from '@/components/GameIcon';
import TeamLogo from '@/components/TeamLogo';
import { LiveTag, ScoreBoard, VersusBadge } from '@/components/MatchVersus';

const box = 'rounded-2xl border border-stone-200/90 bg-stone-50 p-4 sm:p-5 space-y-4';
const eyebrow = 'flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-maroon';

// The mini card inside an announcement for the tournament / match / stream / event it is about
// (data from get_announcement_links: public details only). Buttons depend on who is viewing:
// "Register Now" only for players while registration is open, "Watch Live" opens the stream page
// for logged-in users and the public tournament page (which embeds the stream) otherwise.
export default function AnnouncementLinkCard({ link }: { link: AnnouncementLink }) {
  const viewer = useViewer();
  if (link.type === 'tournament') return <TournamentLink link={link} role={viewer.role} />;
  if (link.type === 'match') return <MatchLink link={link} />;
  if (link.type === 'stream') return <StreamLink link={link} loggedIn={!!viewer.userId} />;
  return <EventLink link={link} />;
}

function TournamentLink({ link, role }: { link: Extract<AnnouncementLink, { type: 'tournament' }>; role: string | null }) {
  const status = getTournamentStatus(link);
  const open = status === 'upcoming';
  const closesAt = registrationClosesAt(link);
  const startsAt = `${link.start_date.slice(0, 10)}T00:00:00+08:00`;
  return (
    <div className={box}>
      <div className="flex items-start gap-3">
        <GameIcon gameId={link.game_id} name={link.game} size="md" />
        <div className="min-w-0 flex-1 space-y-1">
          <p className={eyebrow}><Trophy className="size-3.5" aria-hidden="true" /> Tournament · {statusLabels[status]}</p>
          <p className="font-black text-stone-950 break-words">{link.name}</p>
          <p className="text-xs font-semibold text-stone-600">
            {formatDate(link.start_date)} – {formatDate(link.end_date)}
            <span className="inline-flex items-center gap-1 ml-2"><Users className="size-3.5" aria-hidden="true" />{link.registered} / {link.max_participants}</span>
          </p>
        </div>
      </div>
      {open && closesAt ? (
        <Countdown target={closesAt} prefix="Registration closes in" size="sm" tone="light" />
      ) : status === 'registration_closed' ? (
        <Countdown target={startsAt} prefix="Starts in" size="sm" tone="light" />
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Link href={publicTournamentPath(link.id)} className={smallActionPrimaryClass}>
          View Bracket <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
        {open && role === 'player' && can(role, 'tournament.register') && (
          <Link href={`/tournaments/${link.id}#register`} className={`${smallActionClass} text-stone-950`}>
            <ClipboardPen className="size-4" aria-hidden="true" /> Register Now
          </Link>
        )}
      </div>
      {status !== 'completed' && status !== 'cancelled' && (
        <div className="text-stone-700 [&>div]:justify-start"><CalendarLinks kind="tournament" id={link.id} /></div>
      )}
    </div>
  );
}

function TeamSide({ team, gameId, winner, align }: { team: LinkTeam | null; gameId: string | null; winner: boolean; align: 'left' | 'right' }) {
  const name = team?.name ?? 'TBD';
  return (
    <div className={`flex min-w-0 flex-col items-center gap-2 text-center ${align === 'left' ? '' : ''}`}>
      <span className={`rounded-2xl ${winner ? 'ring-2 ring-gold ring-offset-2 ring-offset-stone-50' : ''}`}>
        <TeamLogo url={team?.logo_url} name={name} gameId={gameId} size="md" />
      </span>
      <span className={`w-full truncate text-xs sm:text-sm uppercase tracking-wide ${winner ? 'font-black text-maroon' : 'font-bold text-stone-700'}`}>
        {winner && <Trophy className="mr-1 inline size-3.5 text-gold" aria-label="Winner" />}
        {name}
      </span>
    </div>
  );
}

function MatchLink({ link }: { link: Extract<AnnouncementLink, { type: 'match' }> }) {
  const finished = link.status === 'completed';
  const live = link.status === 'live';
  return (
    <div className={box}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={eyebrow}>Match · Round {link.round} · {link.tournament_name}</p>
        {live && <LiveTag />}
        {finished && <span className="text-[10px] font-black uppercase tracking-widest text-stone-600">Final</span>}
      </div>
      {/* Scoreboard: logo, name, score; the winner is highlighted */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
        <TeamSide team={link.team_a} gameId={link.game_id} winner={link.winner === 'a'} align="left" />
        <div className="flex flex-col items-center gap-1.5">
          {finished || live ? (
            <ScoreBoard a={link.score_a} b={link.score_b} forfeit={link.is_forfeit} finished={finished} />
          ) : (
            <VersusBadge />
          )}
        </div>
        <TeamSide team={link.team_b} gameId={link.game_id} winner={link.winner === 'b'} align="right" />
      </div>
      {link.status === 'scheduled' && link.scheduled_at && (
        <div className="flex flex-col items-center gap-1 text-center">
          <Countdown target={link.scheduled_at} prefix="Starts in" startedText="Starting now" size="sm" tone="light" />
          <span className="text-xs font-semibold text-stone-600">{formatDateTime(link.scheduled_at)}</span>
        </div>
      )}
      <div className="flex flex-wrap justify-center gap-2">
        <Link href={publicMatchPath(link.tournament_id, link.id)} className={smallActionPrimaryClass}>
          {live ? 'Watch the match' : finished ? 'Match details' : 'View match'} <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
        <Link href={publicTournamentPath(link.tournament_id)} className={`${smallActionClass} text-stone-950`}>View Bracket</Link>
      </div>
      {link.status === 'scheduled' && link.scheduled_at && (
        <div className="text-stone-700"><CalendarLinks kind="match" id={link.id} /></div>
      )}
    </div>
  );
}

function StreamLink({ link, loggedIn }: { link: Extract<AnnouncementLink, { type: 'stream' }>; loggedIn: boolean }) {
  const live = link.status === 'live';
  const href = loggedIn ? `/live/${link.id}` : publicTournamentPath(link.tournament_id);
  return (
    <div className={`${box} ${live ? 'border-red-200 bg-red-50/60' : ''}`}>
      <div className="flex items-start gap-3">
        <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${live ? 'bg-red-600 text-white' : 'bg-ink text-gold'}`}>
          <Radio className={`size-5 ${live ? 'animate-pulse motion-reduce:animate-none' : ''}`} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className={eyebrow}>Stream · {link.tournament_name}</p>
            {live && <LiveTag />}
          </div>
          <p className="font-black text-stone-950 break-words">{link.title}</p>
          <p className="text-xs font-semibold text-stone-600">
            {live ? 'Live now on Facebook' : link.status === 'scheduled' ? 'Starts soon' : 'Stream ended'}
          </p>
        </div>
      </div>
      {link.status !== 'ended' && (
        <Link href={href} className={live ? 'btn btn-primary w-full sm:w-auto' : smallActionPrimaryClass}>
          <PlayCircle className="size-4" aria-hidden="true" /> {live ? 'Watch Live' : 'Stream page'}
        </Link>
      )}
    </div>
  );
}

function EventLink({ link }: { link: Extract<AnnouncementLink, { type: 'event' }> }) {
  const image = siteImageUrl(link.image_path);
  return (
    <div className={`${box} flex flex-col sm:flex-row sm:items-center gap-4`}>
      {image && (
        <span className="relative block aspect-video w-full sm:w-40 shrink-0 overflow-hidden rounded-xl bg-ink">
          <Image src={image} alt="" fill sizes="160px" className="object-cover" />
        </span>
      )}
      <div className="min-w-0 flex-1 space-y-2">
        <p className={eyebrow}><CalendarDays className="size-3.5" aria-hidden="true" /> Event</p>
        <p className="font-black text-stone-950 break-words">{link.title}</p>
        <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-stone-600">
          <span>{link.event_date ? formatDate(link.event_date) : 'Date TBA'}</span>
          {link.venue && <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" aria-hidden="true" />{link.venue}</span>}
        </p>
        {link.event_date && (
          <Countdown target={eventStartsAt(link.event_date).toISOString()} prefix="Starts in" startedText="Happening now" startedFor={24 * 3_600_000} size="sm" tone="light" />
        )}
        <div>
          <Link href={`/events/${link.id}`} className={smallActionPrimaryClass}>
            View event <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
}
