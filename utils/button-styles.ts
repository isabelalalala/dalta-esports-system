// Small action buttons (Share, Copy link, Add to calendar, ...) that sit both on dark page heroes and
// on white cards. They take the text color of the place they are in (text-current), so they stay
// readable on either background; hovering fills them gold with dark text, which reads on both too.
export const smallActionClass =
  'inline-flex items-center justify-center gap-1.5 min-h-10 px-3.5 py-2 rounded-xl border border-current/30 ' +
  'text-xs font-black uppercase tracking-wider transition-colors ' +
  'hover:bg-gold hover:border-gold hover:text-stone-950';

// The main one in a group (e.g. Share): always gold with dark text
export const smallActionPrimaryClass =
  'inline-flex items-center justify-center gap-1.5 min-h-10 px-3.5 py-2 rounded-xl border border-gold bg-gold ' +
  'text-stone-950 text-xs font-black uppercase tracking-wider transition-colors hover:bg-golddark';
