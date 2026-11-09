import { calendarPath, webcalUrl } from '@/utils/site-url';
import { BellRing, CalendarDays, CalendarPlus } from 'lucide-react';
import { smallActionClass } from '@/utils/button-styles';

interface Props {
  kind: 'match' | 'tournament' | 'team';
  id: string;
  label?: string;
}

// "Add to calendar" (.ics download), "Google Calendar" (adds the same calendar feed to Google
// Calendar by its address, so it also updates when match times change), plus "Subscribe" for
// tournaments and teams: a subscribed calendar updates by itself when match times change.
export default function CalendarLinks({ kind, id, label = 'Add to calendar' }: Props) {
  const path = calendarPath(kind, id);
  return (
    <div className="flex flex-wrap justify-center gap-2 print:hidden">
      <a href={path} download className={smallActionClass}>
        <CalendarDays className="h-4 w-4" /> {label}
      </a>
      <a
        href={`https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcalUrl(path))}`}
        target="_blank"
        rel="noopener noreferrer"
        className={smallActionClass}
        title="Add to Google Calendar (opens in a new tab)"
      >
        <CalendarPlus className="h-4 w-4" /> Google Calendar
      </a>
      {kind !== 'match' && (
        <a href={webcalUrl(path)} className={smallActionClass}
          title="Your calendar app keeps these matches up to date">
          <BellRing className="h-4 w-4" /> Subscribe
        </a>
      )}
    </div>
  );
}
