'use client';

import { useEffect, useState } from 'react';
import { BellOff, Settings2 } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import { NOTIFICATION_GROUPS } from '@/utils/notifications';
import { toast } from '@/components/Toaster';

// Notification settings on /notifications: one switch per kind of notification. Turned-off kinds
// are stored in notification_preferences.muted_types (own row, RLS) and the database doesn't create
// them (notify_users()). Moderation, account and removal notices always arrive.
export default function NotificationSettings({ userId, role }: { userId: string; role: string }) {
  const supabase = createClient();
  const [muted, setMuted] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const groups = NOTIFICATION_GROUPS.filter((g) => g.roles.includes(role));

  useEffect(() => {
    supabase.from('notification_preferences').select('muted_types').eq('user_id', userId).maybeSingle()
      .then(({ data }) => setMuted(data?.muted_types ?? []));
  }, [supabase, userId]);

  const toggle = async (types: string[], on: boolean) => {
    if (!muted) return;
    const next = on ? muted.filter((t) => !types.includes(t)) : [...new Set([...muted, ...types])];
    setBusy(true);
    const previous = muted;
    setMuted(next);
    const { error } = await supabase
      .from('notification_preferences')
      .upsert({ user_id: userId, muted_types: next }, { onConflict: 'user_id' });
    setBusy(false);
    if (error) {
      setMuted(previous);
      toast.error(getErrorMessage(error, 'Could not save your notification settings.'));
    }
  };

  if (muted === null || groups.length === 0) return null;

  return (
    <section aria-labelledby="notif-settings-title" className="rounded-3xl border border-stone-200/90 bg-white p-5 sm:p-6 shadow-xs space-y-4">
      <div className="flex items-center gap-2">
        <Settings2 className="size-5 text-maroon" aria-hidden="true" />
        <h2 id="notif-settings-title" className="text-lg font-black uppercase tracking-wider text-stone-950">What to notify me about</h2>
      </div>
      <ul className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(min(100%,18rem),1fr))]">
        {groups.map((g) => {
          const on = !g.types.every((t) => muted.includes(t));
          return (
            <li key={g.key}>
              <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-2xl border border-stone-200/90 p-3 hover:border-gold">
                <input
                  type="checkbox"
                  checked={on}
                  disabled={busy}
                  onChange={(e) => toggle(g.types, e.target.checked)}
                  className="mt-0.5 size-5 accent-amber-600"
                />
                <span>
                  <span className="block text-sm font-black text-stone-950">{g.label}</span>
                  <span className="block text-xs text-stone-600">{g.hint}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <p className="flex items-start gap-2 text-xs text-stone-600">
        <BellOff className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        Warnings, bans, removed content and role changes always arrive, so you know what happened to your account.
      </p>
    </section>
  );
}
