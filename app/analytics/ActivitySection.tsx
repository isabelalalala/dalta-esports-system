'use client';

import ReportChart from '@/components/ReportChart';
import type { ActivityReport } from '@/utils/reports';
import { formatDate, getTournamentStatus, statusLabels } from '@/utils/tournaments';
import { NoData, ReportCard, ReportTable, StatTile, capitalize, formatMonth } from './ReportParts';

// "Overall Tournament Activity & System Report" (Organizing Committee)
export default function ActivitySection({ report }: { report: ActivityReport }) {
  const t = report.totals;

  // Tournament status comes from the dates, the same way as everywhere else in the app
  const statusCounts = new Map<string, number>();
  for (const tour of report.tournaments) {
    const label = statusLabels[getTournamentStatus(tour)];
    statusCounts.set(label, (statusCounts.get(label) || 0) + 1);
  }

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-[#00d2ff] print:text-black">Tournament Activity &amp; System Report</h2>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatTile label="New users" value={t.users} />
        <StatTile label="Tournaments" value={t.tournaments} />
        <StatTile label="Registrations" value={t.registrations} />
        <StatTile label="Teams" value={t.teams} note={`${t.players_in_teams} players`} />
        <StatTile label="Matches played" value={t.matches_played} note={`of ${t.matches_total} (byes not counted)`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ReportCard title="Users by role" note="Accounts created in the date range. Tournament and game filters don't apply.">
          {report.users_by_role.length === 0 ? <NoData /> : (
            <ReportChart type="bar" title="Users by role"
              labels={report.users_by_role.map((r) => capitalize(r.role))}
              series={[{ label: 'Users', data: report.users_by_role.map((r) => r.count) }]} />
          )}
        </ReportCard>

        <ReportCard title="Sign-ups per month">
          {report.signups_by_month.length === 0 ? <NoData /> : (
            <ReportChart type="line" title="Sign-ups per month"
              labels={report.signups_by_month.map((m) => formatMonth(m.month))}
              series={[{ label: 'Sign-ups', data: report.signups_by_month.map((m) => m.count) }]} />
          )}
        </ReportCard>

        <ReportCard title="Tournaments by status">
          {statusCounts.size === 0 ? <NoData /> : (
            <ReportChart type="bar" title="Tournaments by status"
              labels={[...statusCounts.keys()]}
              series={[{ label: 'Tournaments', data: [...statusCounts.values()] }]} />
          )}
        </ReportCard>

        <ReportCard title="Registrations by status">
          {report.registrations_by_status.length === 0 ? <NoData /> : (
            <ReportChart type="bar" title="Registrations by status"
              labels={report.registrations_by_status.map((r) => capitalize(r.status))}
              series={[{ label: 'Registrations', data: report.registrations_by_status.map((r) => r.count) }]} />
          )}
        </ReportCard>

        <ReportCard title="Matches by status" note="Byes are left out.">
          {report.matches_by_status.length === 0 ? <NoData /> : (
            <ReportChart type="bar" title="Matches by status"
              labels={report.matches_by_status.map((m) => capitalize(m.status))}
              series={[{ label: 'Matches', data: report.matches_by_status.map((m) => m.count) }]} />
          )}
        </ReportCard>

        <ReportCard title="Teams by game">
          {report.teams_by_game.length === 0 ? <NoData /> : (
            <ReportChart type="bar" title="Teams by game" horizontal
              labels={report.teams_by_game.map((g) => g.game)}
              series={[{ label: 'Teams', data: report.teams_by_game.map((g) => g.count) }]} />
          )}
        </ReportCard>
      </div>

      <ReportCard title="Tournaments">
        <ReportTable
          columns={['Tournament', 'Game', 'Status', 'Dates', 'Teams (approved / max)', 'Pending', 'Matches played']}
          rows={report.tournaments.map((tour) => [
            tour.name,
            tour.game,
            statusLabels[getTournamentStatus(tour)],
            `${formatDate(tour.start_date)} – ${formatDate(tour.end_date)}`,
            `${tour.approved_teams} / ${tour.max_participants}`,
            tour.pending_teams,
            `${tour.matches_played} / ${tour.matches_total}`,
          ])}
        />
      </ReportCard>
    </section>
  );
}
