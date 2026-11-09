'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import { UserPlus } from 'lucide-react';

interface Props {
  teamId: string;
  // My open request for this team, or null
  requestId: string | null;
  onChanged: () => void;
  // Directory card: just the button, no message box
  compact?: boolean;
  // Button texts (team cards say "Request to join" / "Requested")
  label?: string;
  sentLabel?: string;
}

// "Ask to join" for a recruiting team. The database checks the rules (recruiting, game profile,
// not on another team for the game, roster not full) and returns a readable error otherwise.
// "Cancel request" deletes my own open request.
export default function AskToJoin({
  teamId, requestId, onChanged, compact = false, label = 'Ask to join', sentLabel = 'Request sent',
}: Props) {
  const supabase = createClient();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { error: insertError } = await supabase
        .from('team_join_requests')
        .insert({ team_id: teamId, user_id: session.user.id, message: message.trim() || null });
      if (insertError) throw insertError;
      setMessage('');
      onChanged();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not send the request.'));
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async () => {
    if (!requestId) return;
    setBusy(true);
    setError('');
    try {
      const { data, error: deleteError } = await supabase
        .from('team_join_requests')
        .delete()
        .eq('id', requestId)
        .select('id');
      if (deleteError) throw deleteError;
      // RLS: only my own open request can be deleted; no row = it was already answered
      if (!data || data.length === 0) throw new Error('This request was already answered.');
      onChanged();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not cancel the request.'));
    } finally {
      setBusy(false);
    }
  };

  const errorBox = error && (
    <p role="alert" className="text-xs font-bold text-red-700">{error}</p>
  );

  if (requestId) {
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
            {sentLabel}
          </span>
          <button
            type="button"
            onClick={handleCancel}
            disabled={busy}
            className="text-xs font-bold text-red-700 hover:underline disabled:opacity-50 cursor-pointer"
          >
            Cancel request
          </button>
        </div>
        {errorBox}
      </div>
    );
  }

  if (compact) {
    return (
      <form onSubmit={handleAsk} className="space-y-2">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-xl bg-gold hover:bg-golddark text-stone-950 font-black px-3.5 py-2 text-xs uppercase tracking-wider shadow-xs transition-all disabled:opacity-50 cursor-pointer"
        >
          <UserPlus className="w-3.5 h-3.5" /> {busy ? 'Sending...' : label}
        </button>
        {errorBox}
      </form>
    );
  }

  return (
    <form onSubmit={handleAsk} className="space-y-3">
      <label className="block text-sm font-bold text-stone-800 normal-case">
        Message to the captain (optional)
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={300}
          rows={2}
          placeholder="e.g. I main jungle and I'm free on weekends."
          className="mt-1.5 w-full p-3 rounded-xl bg-white text-stone-950 border border-stone-300 focus:border-gold focus:ring-2 focus:ring-gold/25 shadow-xs outline-none font-medium text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-xl bg-gold hover:bg-golddark text-stone-950 font-black px-5 py-2.5 text-xs uppercase tracking-wider shadow-xs hover:-translate-y-0.5 transition-all disabled:opacity-50 cursor-pointer"
      >
        <UserPlus className="w-4 h-4" /> {busy ? 'Sending...' : label}
      </button>
      {errorBox}
    </form>
  );
}
