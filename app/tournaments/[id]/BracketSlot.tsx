'use client';

import { useEffect, useRef } from 'react';

interface Props {
  teamId: string | null;
  name: string;
  won: boolean;
  scoreText: string;
  className: string;
}

// Restart a CSS animation on an element (remove the class, force a reflow, add it again)
function replay(el: HTMLElement | null, animation: string) {
  if (!el) return;
  el.classList.remove(animation);
  void el.offsetWidth;
  el.classList.add(animation);
}

// One team row in a bracket match box. It remembers what it showed before and animates only
// what changed while the page is open (the bracket reloads live): a team arriving in the slot
// (the winner of the previous round) slides in, a new winner gets a gold sweep, and a changed
// score flashes. Nothing animates on the first render, and nothing with reduced motion (CSS).
export default function BracketSlot({ teamId, name, won, scoreText, className }: Props) {
  const rowRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLSpanElement>(null);
  const scoreRef = useRef<HTMLSpanElement>(null);
  const previous = useRef({ teamId, won, scoreText });

  useEffect(() => {
    const before = previous.current;
    if (teamId && teamId !== before.teamId) replay(nameRef.current, 'animate-team-advance');
    if (won && !before.won) replay(rowRef.current, 'animate-winner-sweep');
    if (scoreText !== before.scoreText && scoreText !== '') replay(scoreRef.current, 'animate-score-flash');
    previous.current = { teamId, won, scoreText };
  }, [teamId, won, scoreText]);

  return (
    <div ref={rowRef} className={className}>
      <span ref={nameRef} className="truncate">{name}</span>
      <span ref={scoreRef} className="tabular-nums font-black">{scoreText}</span>
    </div>
  );
}
