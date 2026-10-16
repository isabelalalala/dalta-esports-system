// Search bar of the public site: a plain form, so it works without JavaScript.
// Results are on /search (tournaments, events and campaigns).
export default function SiteSearchBox({ defaultValue = '' }: { defaultValue?: string }) {
  return (
    <form action="/search" role="search" className="flex w-full max-w-sm">
      <input
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder="Search tournaments, events..."
        aria-label="Search"
        className="flex-1 min-w-0 bg-sitebg border-2 border-r-0 border-brownlight px-3 py-2 text-sm text-white placeholder-gray-400 outline-none focus:border-gold"
      />
      <button type="submit" className="px-3 border-2 border-brownlight bg-brown text-gold font-bold text-sm hover:border-gold">
        Search
      </button>
    </form>
  );
}
