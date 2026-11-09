'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Flame, Handshake, Heart, type LucideIcon } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useViewer } from '@/utils/use-viewer';
import { getErrorMessage } from '@/utils/errors';
import { toast } from '@/components/Toaster';
import { NO_REACTIONS, REACTIONS, REACTION_LABELS, type ReactionCounts, type ReactionKind } from '@/utils/announcements';

const ICONS: Record<ReactionKind, LucideIcon> = { hype: Flame, gg: Handshake, heart: Heart };
// Pressed colors: fire orange, GG gold, heart red (solid when pressed)
const ON: Record<ReactionKind, string> = {
  hype: 'border-orange-500/60 bg-orange-500/15 text-orange-600',
  gg: 'border-gold bg-gold/20 text-stone-950',
  heart: 'border-red-200 bg-red-50 text-red-600',
};

// Hype / GG / heart. Everyone sees the totals; logged-in users toggle their own (RLS: own rows only,
// published posts only). The change shows at once and is undone if saving fails.
export default function AnnouncementReactions({
  announcementId, initial = NO_REACTIONS, size = 'md',
}: { announcementId: string; initial?: ReactionCounts; size?: 'sm' | 'md' }) {
  const viewer = useViewer();
  const [counts, setCounts] = useState<ReactionCounts>(initial);
  const [busy, setBusy] = useState<ReactionKind | null>(null);
  const loggedIn = viewer.status === 'ready' && !!viewer.userId;

  const toggle = async (kind: ReactionKind) => {
    if (!loggedIn || busy) return;
    const had = counts.mine.includes(kind);
    const before = counts;
    setCounts({
      ...counts,
      [kind]: Math.max(0, counts[kind] + (had ? -1 : 1)),
      mine: had ? counts.mine.filter((k) => k !== kind) : [...counts.mine, kind],
    });
    setBusy(kind);
    const supabase = createClient();
    try {
      if (had) {
        const { error } = await supabase.from('announcement_reactions').delete()
          .eq('announcement_id', announcementId).eq('user_id', viewer.userId!).eq('reaction', kind);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('announcement_reactions')
          .upsert({ announcement_id: announcementId, reaction: kind }, { onConflict: 'announcement_id,user_id,reaction', ignoreDuplicates: true });
        if (error) throw error;
      }
    } catch (err) {
      setCounts(before);
      toast.error(getErrorMessage(err, 'Your reaction could not be saved.'));
    } finally {
      setBusy(null);
    }
  };

  const pad = size === 'sm' ? 'h-8 px-2.5 text-xs' : 'h-10 px-3.5 text-sm';

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Reactions">
      {REACTIONS.map((kind) => {
        const Icon = ICONS[kind];
        const mine = counts.mine.includes(kind);
        return (
          <button
            key={kind}
            type="button"
            onClick={() => toggle(kind)}
            disabled={!loggedIn}
            aria-pressed={loggedIn ? mine : undefined}
            title={loggedIn ? REACTION_LABELS[kind] : `${REACTION_LABELS[kind]} · log in to react`}
            className={`relative z-10 inline-flex items-center gap-1.5 rounded-full border font-black tabular-nums transition-all ${pad} ${
              mine ? ON[kind] : 'border-stone-200 bg-surface text-stone-700'
            } ${loggedIn ? 'cursor-pointer hover:-translate-y-0.5 hover:border-gold motion-reduce:hover:translate-y-0 active:scale-95' : 'cursor-default'}`}
          >
            <Icon className={`${size === 'sm' ? 'size-3.5' : 'size-4'} ${mine && kind !== 'gg' ? 'fill-current' : ''} ${mine ? 'reaction-pop' : ''}`} aria-hidden="true" />
            <span className="sr-only">{REACTION_LABELS[kind]}:</span>
            {counts[kind]}
          </button>
        );
      })}
      {viewer.status === 'ready' && !loggedIn && size === 'md' && (
        <Link href="/auth/login" className="relative z-10 text-xs font-bold text-maroon underline underline-offset-2">
          Log in to react
        </Link>
      )}
    </div>
  );
}
