// "✓ Verified" next to a verified student's name. Shows nothing for others
// unless showUnverified is set (e.g. in the registration check).
export default function VerifiedBadge({ verified, showUnverified = false }: { verified: boolean; showUnverified?: boolean }) {
  if (verified) {
    return (
      <span
        title="Verified student"
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-[#3987e5]/60 bg-[#3987e5]/15 text-[#8fbcf2] text-[10px] font-bold uppercase"
      >
        ✓ Verified
      </span>
    );
  }
  if (!showUnverified) return null;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-yellow-500/50 bg-yellow-500/10 text-yellow-300 text-[10px] font-bold uppercase">
      Not verified
    </span>
  );
}
