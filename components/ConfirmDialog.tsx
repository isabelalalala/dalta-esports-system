'use client';

import { useEffect, useRef, type ReactNode } from 'react';

interface Props {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  // 'danger' = red confirm button (removing, banning, deleting)
  tone?: 'danger' | 'normal';
  busy?: boolean;
  // Button text while busy, e.g. 'Uploading...' (default 'Working...')
  busyLabel?: string;
  // Disable the confirm button (e.g. a required reason is still empty)
  confirmDisabled?: boolean;
  error?: string;
  onConfirm: () => void;
  onClose: () => void;
}

// Confirmation modal for destructive or bulk actions. Built on the native <dialog>
// element: showModal() traps focus, Esc closes it and the page behind can't be clicked.
// Render it only while it should be open (the parent decides with a condition).
export default function ConfirmDialog({
  title, children, confirmLabel, tone = 'normal', busy = false, busyLabel = 'Working...', confirmDisabled = false, error, onConfirm, onClose,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);

  const confirmClass =
    tone === 'danger'
      ? 'bg-red-700 hover:bg-red-800 text-white border-red-800'
      : 'bg-gold hover:bg-golddark text-stone-950 border-amber-400';

  return (
    <dialog
      ref={ref}
      aria-labelledby="confirm-dialog-title"
      // Esc fires "cancel": close through the parent so its state stays in sync (not while saving)
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      // A click on the backdrop lands on the <dialog> itself, not on its content
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-stone-200/90 bg-white p-0 text-stone-950 shadow-xl backdrop:bg-stone-950/60"
    >
      <div className="p-5 sm:p-6 space-y-4 max-h-[85vh] overflow-y-auto">
        <h2 id="confirm-dialog-title" className="text-lg font-black uppercase tracking-wide break-words">
          {title}
        </h2>
        <div className="space-y-3 text-sm leading-relaxed text-stone-800">{children}</div>
        {error && (
          <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm font-bold text-red-700">
            {error}
          </p>
        )}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-5 py-2.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-stone-950 text-xs font-black uppercase tracking-widest disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy || confirmDisabled}
            className={`px-5 py-2.5 rounded-xl border text-xs font-black uppercase tracking-widest disabled:opacity-50 cursor-pointer ${confirmClass}`}
          >
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
