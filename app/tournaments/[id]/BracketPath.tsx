'use client';

import { useRef, type ReactNode } from 'react';

const PATH_CLASS = 'bracket-path';

// Wraps the bracket so hovering a team lights up every slot that team played in (CSS
// .bracket-path in globals.css): its route through the rounds is easy to follow. Works on the
// server-rendered bracket by reading the rows' data-team-id (BracketSlot), so the bracket itself
// stays a server component. Mouse only; the same information is in the rows' text.
export default function BracketPath({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const current = useRef<string | null>(null);

  const clear = () => {
    ref.current?.querySelectorAll(`.${PATH_CLASS}`).forEach((el) => el.classList.remove(PATH_CLASS));
    current.current = null;
  };

  const onOver = (e: React.PointerEvent<HTMLDivElement>) => {
    const row = (e.target as HTMLElement).closest<HTMLElement>('[data-team-id]');
    const teamId = row?.dataset.teamId ?? null;
    if (teamId === current.current) return;
    clear();
    if (!teamId || !ref.current) return;
    current.current = teamId;
    ref.current
      .querySelectorAll(`[data-team-id="${CSS.escape(teamId)}"]`)
      .forEach((el) => el.classList.add(PATH_CLASS));
  };

  return (
    <div ref={ref} onPointerOver={onOver} onPointerLeave={clear}>
      {children}
    </div>
  );
}
