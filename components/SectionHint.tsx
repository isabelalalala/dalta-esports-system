'use client';

import { Info } from 'lucide-react';
import Tooltip from '@/components/Tooltip';

// A small (i) next to a section title that explains the section on hover, keyboard focus or a
// long press, e.g. <SectionHint text="Recruiting — accept or decline players who want to join" />
export default function SectionHint({ text, side = 'bottom' }: { text: string; side?: 'top' | 'bottom' | 'right' | 'left' }) {
  return (
    <Tooltip text={text} side={side}>
      <button
        type="button"
        aria-label={`About this section: ${text}`}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-stone-500 hover:text-maroon focus-visible:text-maroon cursor-help"
      >
        <Info className="h-4 w-4" aria-hidden="true" />
      </button>
    </Tooltip>
  );
}
