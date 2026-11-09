import { ClipboardCheck, Eye, Gamepad2, ShieldCheck, type LucideIcon } from 'lucide-react';

// One role badge for the whole app (dashboard welcome banner, profile, admin lists): an icon per
// role in a small circle that softly pulses (a glow ring grows and fades, ~2 s loop; CSS
// .role-pulse in globals.css, off with reduced motion) and the role's name.
// Colors: spectator gray, player yellow, staff blue, admin maroon/red. SVG icons only.
const ROLES: Record<string, { label: string; icon: LucideIcon; dot: string; text: { light: string; dark: string } }> = {
  spectator: { label: 'Spectator', icon: Eye, dot: 'bg-stone-500', text: { light: 'text-stone-700', dark: 'text-stone-200' } },
  player: { label: 'Player', icon: Gamepad2, dot: 'bg-gold', text: { light: 'text-yellow-800', dark: 'text-gold' } },
  staff: { label: 'Tournament Staff', icon: ClipboardCheck, dot: 'bg-sky-600', text: { light: 'text-sky-800', dark: 'text-sky-300' } },
  admin: { label: 'Administrator', icon: ShieldCheck, dot: 'bg-red-700', text: { light: 'text-maroon', dark: 'text-red-300' } },
};

export function roleLabel(role: string | null | undefined): string {
  return ROLES[role ?? '']?.label ?? 'User';
}

export default function RoleBadge({
  role, onDark = false, pulse = true, className = '',
}: {
  role: string | null | undefined;
  // On a dark hero (white glass pill) or on a white card
  onDark?: boolean;
  pulse?: boolean;
  className?: string;
}) {
  const info = ROLES[role ?? ''] ?? ROLES.spectator;
  const Icon = info.icon;
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border py-1 pl-1 pr-3.5 text-xs font-black uppercase tracking-widest ${
        onDark ? `border-white/20 bg-white/10 backdrop-blur-xs ${info.text.dark}` : `border-stone-200 bg-white ${info.text.light}`
      } ${className}`}
    >
      {/* White icon, except on gold (ink); the pulse ring takes the dot's color */}
      <span className={`relative isolate inline-flex size-6 items-center justify-center rounded-full ${role === 'player' ? 'text-ink' : 'text-white'} ${info.dot} ${pulse ? 'role-pulse' : ''}`} aria-hidden="true">
        <Icon className="size-3.5" />
      </span>
      <span>{role ? info.label : 'User'}</span>
    </span>
  );
}
