'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import { TEAM_LOGOS_BUCKET, avatarPathFromUrl } from '@/utils/avatars';
import TeamLogo from '@/components/TeamLogo';
import AvatarUploader from '@/components/AvatarUploader';
import ConfirmDialog from '@/components/ConfirmDialog';
import { toast } from '@/components/Toaster';

interface Props {
  team: { id: string; name: string; game_id: string; logo_url?: string | null; gameName?: string | null };
  isCaptain: boolean;
  // Admin/staff: may only remove a logo (with a reason the captain sees), never upload one
  canRemove: boolean;
  onChanged: () => void;
}

// Team logo on the team page: the captain adds / changes / removes it (same square crop as profile
// pictures, team-logos bucket); organizers can take one down with remove_team_logo(team, reason),
// which logs it and notifies the captain. Everyone else just sees the logo (or the initials).
export default function TeamLogoSection({ team, isCaptain, canRemove, onChanged }: Props) {
  const supabase = createClient();
  const [url, setUrl] = useState(team.logo_url ?? null);
  const [removing, setRemoving] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const logo = <TeamLogo url={url} name={team.name} gameId={team.game_id} gameName={team.gameName} size="xl" />;

  if (isCaptain) {
    return (
      <AvatarUploader
        kind="team-logo"
        userId={team.id}
        name={team.name}
        url={url}
        preview={logo}
        onChange={(next) => {
          setUrl(next);
          onChanged();
        }}
      />
    );
  }

  const removeLogo = async () => {
    setBusy(true);
    setError('');
    try {
      const { error: rpcError } = await supabase.rpc('remove_team_logo', { p_team_id: team.id, p_reason: reason.trim() });
      if (rpcError) throw rpcError;
      // The file isn't needed any more (a failure here only leaves an unused file)
      const path = avatarPathFromUrl(url, TEAM_LOGOS_BUCKET);
      if (path) await supabase.storage.from(TEAM_LOGOS_BUCKET).remove([path]);
      setUrl(null);
      setRemoving(false);
      setReason('');
      toast.success('Team logo removed. The captain was notified.');
      onChanged();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not remove the logo.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      {logo}
      {canRemove && url && (
        <button type="button" onClick={() => setRemoving(true)} className="btn btn-secondary">
          <Trash2 className="size-4" aria-hidden="true" /> Remove logo
        </button>
      )}
      {removing && (
        <ConfirmDialog
          title="Remove this team logo?"
          confirmLabel="Remove logo"
          tone="danger"
          busy={busy}
          busyLabel="Removing..."
          error={error}
          confirmDisabled={reason.trim().length < 3}
          onConfirm={removeLogo}
          onClose={() => setRemoving(false)}
        >
          <p>The captain is notified with your reason and can upload a different logo.</p>
          <label className="block text-sm font-bold text-stone-800">
            Reason (the captain will see it)
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={300}
              rows={2}
              className="mt-1.5 w-full rounded-xl border border-stone-300 bg-white p-3 text-sm font-medium text-stone-950 shadow-xs outline-none focus:border-gold focus:bg-surface focus:ring-2 focus:ring-gold/25"
            />
          </label>
        </ConfirmDialog>
      )}
    </div>
  );
}
