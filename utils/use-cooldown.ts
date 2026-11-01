import { useEffect, useState } from 'react';

// A countdown for buttons that send emails ("Resend in 42s"), so one person can't use up
// the project's email limit by clicking again and again.
// start(seconds) begins the wait; `remaining` is the seconds left (0 = the button may be used).
export function useCooldown() {
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (until === 0) return;
    const timer = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= until) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [until]);

  const start = (seconds: number) => {
    const t = Date.now();
    setNow(t);
    setUntil(t + seconds * 1000);
  };

  const remaining = until > now ? Math.ceil((until - now) / 1000) : 0;
  return { remaining, start };
}
