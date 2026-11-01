import { calendarPath, webcalUrl } from '@/utils/site-url';
import { BellRing, CalendarDays } from 'lucide-react';
import { smallActionClass } from '@/utils/button-styles';

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
    <div className="flex flex-wrap justify-center gap-2 print:hidden">
      <a href={path} download className={smallActionClass}>
        <CalendarDays className="h-4 w-4" /> {label}
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
