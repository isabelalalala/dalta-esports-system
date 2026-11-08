'use client';

import ReportChart from '@/components/ReportChart';
import type { ModerationReport } from '@/utils/reports';
import { OFFENSE_LABELS } from '@/utils/report-insights';
import { NoData, ReportCard, StatTile, capitalize, formatDay, type Insights } from './ReportParts';

// Moderation stats (Phase 5): warnings, hidden/removed comments and feedback, offense types, bans.
// Reports saved before Phase 5 have no moderation data: the page doesn't render this section.
export default function ModerationSection({ report, insights = {} }: { report: ModerationReport; insights?: Insights }) {
  const t = report.totals;
  const outcomes: [string, number][] = [
    ['Profanity (stayed visible)', t.comments_profane],
    ['Hidden comments', t.comments_hidden],
    ['Removed comments', t.comments_removed],
    ['Restored comments', t.comments_restored],
    ['Hidden feedback', t.feedback_hidden],
    ['Removed feedback', t.feedback_removed],
  ];
  const anyOutcome = outcomes.some(([, count]) => Number(count) > 0);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl sm:text-2xl font-black text-amber-800 uppercase tracking-wider print:text-black">
          Moderation
        </h2>
        <p className="text-xs text-stone-500 font-medium normal-case mt-1">
          AI moderation of stream comments and feedback, warnings and bans. Ban counts come from the activity log and
          ignore the tournament and game filters.
        </p>
      </div>

      <div className="grid grid-cols-2 @3xl:grid-cols-3 @5xl:grid-cols-6 gap-3">
        <StatTile label="Warnings" value={t.warnings} note={`${t.active_warnings} still active`} />
        <StatTile label="From the AI" value={t.ai_warnings} note={`${t.moderator_warnings} from moderators`} />
        <StatTile label="Hidden comments" value={t.comments_hidden} note={`${t.comments_restored} restored`} />
        <StatTile label="Hidden feedback" value={t.feedback_hidden} />
        <StatTile label="Accounts flagged" value={t.accounts_flagged} note={`${t.pending_bans_now} waiting now`} />
        <StatTile label="Bans" value={t.accounts_banned} note={`${t.banned_now} banned now`} />
      </div>

      <div className="grid grid-cols-1 @5xl:grid-cols-2 gap-4">
        <ReportCard title="Moderation outcomes" note={`${t.comments} comments and ${t.feedback} feedback entries in the date range.`} insight={insights.moderation_outcomes}>
          {!anyOutcome ? <NoData text="Nothing was flagged, hidden or removed for these filters." /> : (
            <ReportChart type="bar" title="Moderation outcomes" horizontal
              labels={outcomes.map(([label]) => label)}
              categoryTitle="Outcome" valueTitle="Items (count)"
              series={[{ label: 'Items', data: outcomes.map(([, count]) => Number(count)) }]} />
          )}
        </ReportCard>

        <ReportCard title="Warnings over time" note="Warnings per week (weeks start on Monday)." insight={insights.warnings_over_time}>
          {report.warnings_by_week.length === 0 ? <NoData text="No warnings for these filters." /> : (
            <ReportChart type="line" title="Warnings over time"
              labels={report.warnings_by_week.map((w) => formatDay(w.week))}
              categoryTitle="Week starting" valueTitle="Warnings (count)"
              series={[
                { label: 'Profanity', data: report.warnings_by_week.map((w) => Number(w.profanity)), slot: 3 },
                { label: 'Offensive content', data: report.warnings_by_week.map((w) => Number(w.offensive)), slot: 7 },
              ]} />
          )}
        </ReportCard>

        <ReportCard title="Offense types" note="Comments and feedback the AI marked as offensive." insight={insights.offense_types}>
          {report.offense_types.length === 0 ? <NoData text="No offensive content for these filters." /> : (
            <ReportChart type="bar" title="Offense types" horizontal
              labels={report.offense_types.map((o) => capitalize(OFFENSE_LABELS[o.offense_type] ?? o.offense_type))}
              categoryTitle="Offense type" valueTitle="Items (count)"
              series={[{ label: 'Offensive items', data: report.offense_types.map((o) => Number(o.count)) }]} />
          )}
        </ReportCard>
      </div>
    </section>
  );
}
