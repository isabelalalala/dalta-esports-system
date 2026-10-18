import type { ReactNode } from 'react';
import { Star } from 'lucide-react';

// Small building blocks shared by the report sections

// A headline number, e.g. "Views 128"
export function StatTile({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return (
    <div className="bg-sitecard border border-brownlight p-4 print:border-gray-400 print:bg-white">
      <p className="text-xs uppercase font-bold text-gray-400 print:text-gray-600">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {note && <p className="text-xs text-gray-400 mt-1">{note}</p>}
    </div>
  );
}

// A titled card around a chart or table. break-inside-avoid keeps it on one printed page.
export function ReportCard({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <div className="bg-sitecard border border-brownlight p-4 break-inside-avoid print:border-gray-400 print:bg-white">
      <h3 className="font-bold text-gold print:text-black">{title}</h3>
      {note && <p className="text-xs text-gray-400 mb-2 print:text-gray-600">{note}</p>}
      <div className="mt-2">{children}</div>
    </div>
  );
}

// Shown instead of a chart that has no data
export function NoData({ text = 'No data for these filters.' }: { text?: string }) {
  return <p className="text-gray-400 text-sm py-8 text-center">{text}</p>;
}

// A simple table; numbers are right-aligned so they line up
export function ReportTable({ columns, rows }: { columns: string[]; rows: ReactNode[][] }) {
  if (rows.length === 0) return <NoData />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase text-gray-400 border-b border-gray-700 print:text-gray-600">
            {columns.map((c, i) => (
              <th key={c} className={`py-2 pr-3 ${i > 0 ? 'text-right' : ''}`}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r} className="border-b border-gray-800 print:border-gray-300">
              {row.map((cell, i) => (
                <td key={i} className={`py-2 pr-3 ${i > 0 ? 'text-right tabular-nums' : ''}`}>{cell}</td>
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
    <span className="inline-flex items-center gap-1">
      {Number(value).toFixed(1)} <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
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
