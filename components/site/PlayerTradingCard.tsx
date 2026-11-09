import Image from 'next/image';
import { Crown, Gamepad2, Shield, User } from 'lucide-react';
import { siteImageUrl, type OfficialTeamPlayer } from '@/utils/site';

// An official team player as a trading card: the front shows the photo and IGN, the back shows
// the details (IGN, role, name, team, game). It flips on hover, on keyboard focus and on a tap
// (the card is focusable), CSS "flip-card" in globals.css. With reduced motion the back fades in
// instead of turning. Screen readers read the back only (the front repeats it as a picture).
export default function PlayerTradingCard({
  player, teamName, gameName,
}: { player: OfficialTeamPlayer; teamName: string; gameName: string }) {
  const photo = siteImageUrl(player.photo_path);
  const name = player.name || player.ign;
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
  const frame = player.is_captain ? 'border-gold' : 'border-stone-800/80';

  return (
    <div
      tabIndex={0}
      className="flip-card group h-80 rounded-2xl outline-none focus-visible:ring-4 focus-visible:ring-gold/50"
      aria-label={`${player.ign}${player.is_captain ? ', team captain' : ''}${player.role ? `, ${player.role}` : ''}`}
    >
      <div className="flip-card-inner">
        {/* Front: photo + IGN */}
        <div aria-hidden="true" className={`flip-face flip-front overflow-hidden rounded-2xl border-2 ${frame} bg-ink shadow-md`}>
          <div className="absolute inset-0 bg-logo-stage-strong" />
          {photo ? (
            <Image src={photo} alt="" fill sizes="(max-width: 768px) 90vw, 300px" className="object-cover" />
          ) : (
            <span className="absolute inset-0 grid place-items-center text-6xl font-black text-gold/80">{initials || '?'}</span>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4 pt-12">
            <p className="truncate text-xl font-black uppercase tracking-wide text-white">{player.ign}</p>
            {player.role && <p className="truncate text-xs font-black uppercase tracking-widest text-gold">{player.role}</p>}
          </div>
          {player.is_captain && (
            <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-md bg-maroon px-2 py-1 text-[10px] font-black uppercase tracking-widest text-white shadow-xs">
              <Crown className="size-3 text-gold" /> Captain
            </span>
          )}
          <span className="absolute right-3 top-3 rounded-md border border-white/20 bg-black/50 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-stone-200">
            {gameName}
          </span>
        </div>

        {/* Back: the details */}
        <div className={`flip-face flip-back overflow-hidden rounded-2xl border-2 ${frame} bg-ink p-5 shadow-md`}>
          <div className="absolute inset-0 bg-logo-stage" aria-hidden="true" />
          <div className="relative flex h-full flex-col justify-between">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-gold">Player card</p>
              <p className="break-words text-2xl font-black uppercase leading-tight tracking-wide text-white">{player.ign}</p>
              {player.is_captain && (
                <p className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-widest text-gold">
                  <Crown className="size-3.5" aria-hidden="true" /> Team captain
                </p>
              )}
            </div>
            <dl className="space-y-2.5 text-sm">
              {player.role && <Detail icon={<Gamepad2 className="size-4" />} label="Role" value={player.role} />}
              {player.name && <Detail icon={<User className="size-4" />} label="Name" value={player.name} />}
              <Detail icon={<Shield className="size-4" />} label="Team" value={teamName} />
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}

function Detail({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5 border-t border-white/10 pt-2.5">
      <span className="mt-0.5 text-gold" aria-hidden="true">{icon}</span>
      <div className="min-w-0">
        <dt className="text-[10px] font-black uppercase tracking-widest text-stone-400">{label}</dt>
        <dd className="break-words font-bold text-white">{value}</dd>
      </div>
    </div>
  );
}
