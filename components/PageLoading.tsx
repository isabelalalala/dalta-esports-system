// The one loading screen of the app (logged-in pages load their data in the browser).
// role="status" makes screen readers announce it.
export default function PageLoading({ label = 'Loading...' }: { label?: string }) {
  return (
    <div role="status" className="min-h-[60vh] flex-1 bg-sitebg text-white grid place-items-center px-4">
      <div className="flex flex-col items-center gap-4">
        {/* Three blinking squares in the pixel style */}
        <div className="flex gap-2" aria-hidden>
          <span className="w-3 h-3 bg-gold animate-pulse" />
          <span className="w-3 h-3 bg-gold animate-pulse [animation-delay:150ms]" />
          <span className="w-3 h-3 bg-gold animate-pulse [animation-delay:300ms]" />
        </div>
        <p className="text-gray-400 text-sm">{label}</p>
      </div>
    </div>
  );
}

// Small inline version for a section inside a page
export function SectionLoading({ label = 'Loading...' }: { label?: string }) {
  return (
    <p role="status" className="text-gray-400 text-sm flex items-center gap-2">
      <span className="w-2 h-2 bg-gold animate-pulse" aria-hidden />
      {label}
    </p>
  );
}
