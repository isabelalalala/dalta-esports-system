import { Lightbulb, ListChecks } from 'lucide-react';
import type { ReportInsights } from '@/utils/report-insights';

// The overall summary at the top of a report: key findings and recommendations for the
// Organizing Committee (Phase 5). The numbers are computed by the app; when Gemini wrote the
// wording, every number in it was checked against the data first (utils/report-insights.ts).
export default function SummarySection({ insights, saved }: { insights: ReportInsights; saved: boolean }) {
  const byline = !saved
    ? 'This report was saved before written summaries existed, so the summary was calculated from its numbers when you opened it.'
    : insights.writer === 'gemini'
      ? 'Numbers computed by the system; wording by Gemini, with every number checked against the data.'
      : 'Written automatically from the computed numbers.';

  return (
    <section className="rounded-2xl border border-stone-200/90 bg-white p-5 sm:p-6 shadow-xs break-inside-avoid space-y-5 print:border-stone-300 print:shadow-none">
      <div>
        <h2 className="text-xl sm:text-2xl font-black text-amber-800 uppercase tracking-wider print:text-black">Summary</h2>
        <p className="text-xs text-stone-500 font-medium normal-case mt-1">{byline}</p>
        {insights.note && <p className="text-xs text-stone-500 font-medium normal-case mt-1 print:hidden">Note: {insights.note}</p>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-stone-950">
            <ListChecks className="h-4 w-4 text-maroon" aria-hidden="true" /> Key findings
          </h3>
          {insights.findings.length === 0 ? (
            <p className="mt-2 text-sm text-stone-600">There is no data for these filters yet.</p>
          ) : (
            <ul className="mt-2 space-y-2 list-disc pl-5 text-sm leading-relaxed text-stone-800 marker:text-maroon">
              {insights.findings.map((f, i) => <li key={i} className="break-words">{f}</li>)}
            </ul>
          )}
        </div>
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-stone-950">
            <Lightbulb className="h-4 w-4 text-maroon" aria-hidden="true" /> Recommendations
          </h3>
          <ul className="mt-2 space-y-2 list-disc pl-5 text-sm leading-relaxed text-stone-800 marker:text-maroon">
            {insights.recommendations.map((r, i) => <li key={i} className="break-words">{r}</li>)}
          </ul>
        </div>
      </div>
    </section>
  );
}
