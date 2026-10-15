'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import type { MyTeamInvite } from '@/utils/types';

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
    <section className="bg-[#1a1a2e] border border-[#00d2ff] rounded-xl p-6 mb-8 space-y-4">
      <h2 className="text-xl font-bold text-[#00d2ff]">✉️ Team invites</h2>

      {error && <div className="bg-red-500/10 border border-red-500 text-red-300 px-4 py-3 rounded-lg">{error}</div>}
      {message && <div className="bg-green-500/10 border border-green-500 text-green-300 px-4 py-3 rounded-lg">{message}</div>}

      {invites.length > 0 && (
        <ul className="divide-y divide-[#00d2ff]/20">
          {invites.map((invite) => {
            const busy = busyId === invite.invite_id;
            return (
              <li key={invite.invite_id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-white">
                    {invite.team_name} <span className="text-gray-400 font-normal">· {invite.game_name}</span>
                  </p>
                  <p className="text-sm text-gray-400">
                    Captain: {invite.captain_name || 'Unnamed'} · {invite.member_count} / {invite.max_players} players
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => respond(invite, true)}
                    disabled={busy}
                    className="bg-[#00d2ff] text-black px-4 py-2 rounded-lg font-bold hover:bg-[#00b8e6] disabled:opacity-50"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => respond(invite, false)}
                    disabled={busy}
                    className="border border-red-500 text-red-300 px-4 py-2 rounded-lg font-bold hover:bg-red-500/10 disabled:opacity-50"
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
