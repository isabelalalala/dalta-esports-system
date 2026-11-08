'use client';

import { eventStartsAt } from '@/utils/site';
import Countdown from './Countdown';

// Countdown to an event day (midnight Manila time; events have a date, no time of day)
export default function EventCountdown({
  eventDate, tone = 'dark', size = 'lg', prefix,
}: { eventDate: string; tone?: 'dark' | 'light'; size?: 'lg' | 'sm'; prefix?: string }) {
  return (
    <Countdown
      target={eventStartsAt(eventDate).toISOString()}
      // Started: it's the event day (the card disappears after the next cache refresh)
      startedText="Happening today"
      startedFor={24 * 60 * 60 * 1000}
      tone={tone}
      size={size}
      prefix={prefix}
    />
  );
}
