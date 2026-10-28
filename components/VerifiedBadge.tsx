import { BadgeCheck } from 'lucide-react';

// "Verified" badge next to a verified student's name. Shows nothing for others
// unless showUnverified is set (e.g. in the registration check).
export default function VerifiedBadge({ verified, showUnverified = false }: { verified: boolean; showUnverified?: boolean }) {
  if (verified) {
    return (
      <span
        title="Verified student"
        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-blue-200 bg-blue-50 text-blue-700 text-[10px] font-black uppercase tracking-wider"
      >
        <BadgeCheck className="h-3.5 w-3.5" /> Verified
      </span>
    );
  }
  if (!showUnverified) return null;
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full border border-amber-200 bg-amber-50 text-amber-800 text-[10px] font-black uppercase tracking-wider">
      Not verified
    </span>
  );
}
