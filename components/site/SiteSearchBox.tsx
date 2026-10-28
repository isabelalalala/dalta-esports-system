import { Search } from 'lucide-react';

// Search bar of the public site: a plain form, so it works without JavaScript.
// Results are on /search (tournaments, events and campaigns).
// Polished: Locked h-10 container, aligned on vertical axis with logo & auth CTAs.
export default function SiteSearchBox({ defaultValue = '' }: { defaultValue?: string }) {
  return (
    <form
      action="/search"
      role="search"
      className="flex items-center w-full h-10 rounded-xl border border-stone-200 bg-stone-50/90 hover:border-stone-300 focus-within:bg-white focus-within:border-amber-600 focus-within:ring-2 focus-within:ring-amber-500/20 shadow-xs transition-all overflow-hidden group"
    >
      <div className="pl-3.5 pr-1.5 flex items-center justify-center text-stone-400 group-focus-within:text-amber-600 transition-colors shrink-0">
        <Search className="w-4 h-4" aria-hidden="true" />
      </div>
      <input
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder="Search tournaments, events..."
        aria-label="Search"
        className="flex-1 min-w-0 h-full bg-transparent px-2 text-xs sm:text-sm text-stone-950 placeholder:text-stone-400 uppercase tracking-wide outline-none font-medium"
      />
      <button
        type="submit"
        className="h-full px-4 sm:px-5 bg-stone-950 hover:bg-amber-600 text-white font-extrabold text-xs uppercase tracking-wider transition-colors shrink-0 flex items-center justify-center"
      >
        Search
      </button>
    </form>
  );
}
