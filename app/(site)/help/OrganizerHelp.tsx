import { Lock } from 'lucide-react';
import { createClient } from '@/utils/supabase/server';
import { ORGANIZER_HELP_SECTIONS } from '@/utils/help-organizer';
import HelpSectionView from '@/components/HelpSectionView';

// Staff and admin help, rendered on the server only for a logged-in organizer: the role comes
// from get_my_role() with the user's own session, so for everyone else (logged out, players,
// spectators) nothing about these questions is sent. Staff see the staff section, admins both.
// Read cookies, so the page renders it inside <Suspense> (the rest of /help stays static).
export default async function OrganizerHelp() {
  const supabase = await createClient();
  const { data: role, error } = await supabase.rpc('get_my_role');
  if (error || (role !== 'admin' && role !== 'staff')) return null;

  const sections = ORGANIZER_HELP_SECTIONS.filter((s) => s.id === 'staff' || role === 'admin');

  return (
    <div className="space-y-10 border-t border-stone-200/90 pt-10">
      <p className="inline-flex items-center gap-2 rounded-full border border-stone-200/90 bg-stone-50 px-4 py-2 text-xs font-black uppercase tracking-widest text-stone-600">
        <Lock className="size-4 text-maroon" aria-hidden="true" /> Organizer help · only organizers can see this part
      </p>
      {sections.map((section) => (
        <HelpSectionView key={section.id} section={section} />
      ))}
    </div>
  );
}
