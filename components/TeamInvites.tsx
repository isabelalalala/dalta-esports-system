'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import type { MyTeamInvite } from '@/utils/types';
import { Mail } from 'lucide-react';

// The logged-in player's open team invites with Accept / Decline.
// Shown on the dashboard and on /teams; shows nothing when there are no invites.
// onAnswered lets the page reload (e.g. the team list after accepting).
export default function TeamInvites({ onAnswered }: { onAnswered?: () => void }) {
  const supabase = createClient();
  const [invites, setInvites] = useState<MyTeamInvite[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  // Increase this to load the invites again
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    const load = async () => {
      // Names come from a database function, because players can't read other profiles
      const { data, error: loadError } = await supabase.rpc('get_my_team_invites');
      if (loadError) {
        setError(getErrorMessage(loadError, 'Failed to load team invites'));
        return;
      }
      setInvites(data || []);
    };
    load();
  }, [supabase, reloadCount]);

  const respond = async (invite: MyTeamInvite, accept: boolean) => {
    setBusyId(invite.invite_id);
    setError('');
    setMessage('');
    try {
      // Accepting adds you to the team; the database checks the roster rules again
      const { error: respondError } = await supabase.rpc('respond_to_team_invite', {
        p_invite_id: invite.invite_id,
        p_accept: accept,
      });
      if (respondError) throw respondError;
      setMessage(accept ? `You joined ${invite.team_name}.` : `You declined the invite from ${invite.team_name}.`);
      setReloadCount((n) => n + 1);
      onAnswered?.();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to answer the invite'));
    } finally {
      setBusyId(null);
    }
  };

  if (invites.length === 0 && !error && !message) return null;

  return (
    <section className="w-full rounded-3xl border border-stone-200/90 bg-white p-6 sm:p-8 shadow-xs space-y-6 uppercase">
      <div className="flex items-center gap-3 pb-4 border-b border-stone-100">
        <div className="w-10 h-10 rounded-xl bg-[#5B271E]/10 border border-[#5B271E]/20 text-[#5B271E] flex items-center justify-center shadow-2xs">
          <Mail className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-stone-950 tracking-wider">
            Team Invites
          </h2>
          <p className="text-xs text-stone-500 font-medium tracking-wide mt-0.5">
            Invitations to join competitive tournament rosters
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-500/30 rounded-xl text-red-700 px-4 py-3 text-xs sm:text-sm font-bold uppercase tracking-wider">
          {error}
        </div>
      )}
      {message && (
        <div className="bg-emerald-50 border border-emerald-500/30 rounded-xl text-emerald-800 px-4 py-3 text-xs sm:text-sm font-bold uppercase tracking-wider">
          {message}
        </div>
      )}

      {invites.length > 0 && (
        <ul className="space-y-3">
          {invites.map((invite) => {
            const busy = busyId === invite.invite_id;
            return (
              <li
                key={invite.invite_id}
                className="p-4 sm:p-5 rounded-2xl border border-stone-200/80 bg-stone-50/60 hover:bg-white hover:border-amber-500/40 hover:shadow-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div>
                  <p className="font-black text-stone-950 text-sm sm:text-base tracking-wide">
                    {invite.team_name} <span className="text-amber-700 font-bold">· {invite.game_name}</span>
                  </p>
                  <p className="text-xs text-stone-500 font-medium mt-1">
                    Captain: {invite.captain_name || 'Unnamed'} · {invite.member_count} / {invite.max_players} players
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => respond(invite, true)}
                    disabled={busy}
                    className="rounded-xl border border-amber-400 bg-gold text-stone-950 px-4 py-2 font-black text-xs uppercase tracking-wider shadow-xs hover:bg-golddark hover:-translate-y-0.5 transition-all disabled:opacity-50"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => respond(invite, false)}
                    disabled={busy}
                    className="rounded-xl border border-stone-200 text-stone-700 px-4 py-2 font-extrabold text-xs uppercase tracking-wider shadow-xs hover:text-red-700 hover:bg-red-50 transition-all disabled:opacity-50"
                  >
                    Decline
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
