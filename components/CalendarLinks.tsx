import { calendarPath, webcalUrl } from '@/utils/site-url';

interface Props {
  kind: 'match' | 'tournament' | 'team';
  id: string;
  label?: string;
}

// "Add to calendar" (.ics download), plus "Subscribe" for tournaments and teams: a subscribed
// calendar updates by itself when match times change.
export default function CalendarLinks({ kind, id, label = 'Add to calendar' }: Props) {
  const path = calendarPath(kind, id);
  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      <a href={path} download className="px-3 py-1.5 border-2 border-brownlight text-sm font-bold hover:border-gold hover:text-gold">
        📅 {label}
      </a>
      {kind !== 'match' && (
        <a href={webcalUrl(path)} className="px-3 py-1.5 border-2 border-brownlight text-sm font-bold hover:border-gold hover:text-gold"
          title="Your calendar app keeps these matches up to date">
          🔔 Subscribe
        </a>
      )}
    </div>
  );
}
