'use client';

import { useCallback, useRef, useState, type ReactNode } from 'react';
import ConfirmDialog from '@/components/ConfirmDialog';

interface Ask {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  // 'danger' = red button (delete, remove, withdraw)
  tone?: 'danger' | 'normal';
}

// The app's ConfirmDialog as a one-liner, replacing the browser's confirm() popup (which looks
// different in every browser and can't be styled):
//   const [confirmDialog, ask] = useConfirm();
//   if (!(await ask({ title: 'Delete team?', message: '...', confirmLabel: 'Delete', tone: 'danger' }))) return;
//   ...and render {confirmDialog} once in the page.
// Esc, Cancel and a click outside all answer "no".
export function useConfirm(): [ReactNode, (ask: Ask) => Promise<boolean>] {
  const [open, setOpen] = useState<Ask | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const ask = useCallback((next: Ask) => {
    resolver.current?.(false); // a second question cancels the first
    setOpen(next);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const answer = (ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setOpen(null);
  };

  const dialog = open ? (
    <ConfirmDialog
      title={open.title}
      confirmLabel={open.confirmLabel}
      tone={open.tone}
      onConfirm={() => answer(true)}
      onClose={() => answer(false)}
    >
      {typeof open.message === 'string' ? <p>{open.message}</p> : open.message}
    </ConfirmDialog>
  ) : null;

  return [dialog, ask];
}
