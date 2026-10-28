import type { ReactNode } from 'react';
import { Star } from 'lucide-react';

// Small building blocks shared by the report sections

// A headline number, e.g. "Views 128"
export function StatTile({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return (
    <div className="bg-white border border-stone-200/90 rounded-2xl p-4 sm:p-5 shadow-xs text-stone-950 transition-all hover:-translate-y-0.5 print:border-stone-300 print:shadow-none">
      <p className="text-[11px] uppercase font-black text-stone-500 tracking-wider mb-1">{label}</p>
      <p className="text-2xl sm:text-3xl font-black text-stone-950 tracking-tight">{value}</p>
      {note && <p className="text-xs font-semibold text-stone-400 mt-1">{note}</p>}
    </div>
  );
}

// A titled card around a chart or table. break-inside-avoid keeps it on one printed page.
export function ReportCard({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <div className="bg-white border border-stone-200/90 rounded-2xl p-5 sm:p-6 shadow-xs break-inside-avoid text-stone-950 print:border-stone-300 print:shadow-none">
      <h3 className="font-black text-amber-800 text-sm sm:text-base uppercase tracking-wider">{title}</h3>
      {note && <p className="text-xs text-stone-500 font-medium normal-case mt-0.5 mb-3">{note}</p>}
      <div className="mt-2">{children}</div>
    </div>
  );
}

// Shown instead of a chart that has no data
export function NoData({ text = 'No data for these filters.' }: { text?: string }) {
  return (
    <div className="rounded-xl border border-stone-200/80 bg-stone-50/70 p-8 text-center text-stone-500 font-bold tracking-wider text-xs uppercase">
      {text}
    </div>
  );
}

// A simple table; numbers are right-aligned so they line up
export function ReportTable({ columns, rows }: { columns: string[]; rows: ReactNode[][] }) {
  if (rows.length === 0) return <NoData />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs sm:text-sm">
        <thead>
          <tr className="text-left text-xs uppercase font-black text-stone-500 tracking-wider border-b border-stone-200">
            {columns.map((c, i) => (
              <th key={c} className={`py-3 pr-4 ${i > 0 ? 'text-right' : ''}`}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {rows.map((row, r) => (
            <tr key={r} className="hover:bg-stone-50/80 transition-colors">
              {row.map((cell, i) => (
                <td key={i} className={`py-3 pr-4 font-medium text-stone-800 ${i > 0 ? 'text-right tabular-nums' : ''}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// "4.3" with a star icon, or "–" when there's nothing to average
export function formatRating(value: number | null) {
  if (value === null) return '–';
  return (
    <span className="inline-flex items-center gap-1 font-black text-amber-700">
      {Number(value).toFixed(1)} <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
    </span>
  );
}

// "Oct 2026" for a YYYY-MM-DD month start
export function formatMonth(value: string) {
  const [year, month] = value.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

// "Oct 19" for a YYYY-MM-DD day (built from the parts so the time zone can't shift it)
export function formatDay(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// "player" -> "Player"
export function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
