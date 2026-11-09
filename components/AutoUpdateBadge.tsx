import Tooltip from '@/components/Tooltip';

// Small "Updates automatically" pill for sections that reload by themselves (Realtime +
// polling), so people know they don't need to refresh (Nielsen #1 "visibility of system status").
export default function AutoUpdateBadge({ label = 'Updates automatically' }: { label?: string }) {
  return (
    <Tooltip text="Scores, times and results change here as soon as staff update them. No need to refresh.">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-800">
        <span className="relative flex size-2" aria-hidden="true">
          <span className="absolute inline-flex size-full rounded-full bg-emerald-500 opacity-60 animate-ping" />
          <span className="relative inline-flex size-2 rounded-full bg-emerald-600" />
        </span>
        {label}
      </span>
    </Tooltip>
  );
}
