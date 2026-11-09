'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';

// Toasts: short messages after an action ("Feedback sent", "Team removed"). Call toast() from any
// client component; <Toaster /> (once, in app/layout.tsx) shows them in the bottom corner and
// screen readers announce them. Optional action button, e.g. Undo.
//   toast.success('Saved.')   toast.error('Could not save.')   toast('Comment deleted', { action })
// Keep the inline messages next to forms for errors the user must fix there; a toast is the
// "it worked" confirmation that stays visible even after the page scrolls or the form closes.

type Tone = 'success' | 'error' | 'info';
interface ToastAction { label: string; onClick: () => void }
interface ToastItem { id: number; message: string; tone: Tone; action?: ToastAction; duration: number }
interface Options { action?: ToastAction; duration?: number }

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function dismiss(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

function show(message: string, tone: Tone, options: Options = {}) {
  const item: ToastItem = {
    id: nextId++,
    message,
    tone,
    action: options.action,
    // Errors and toasts with a button stay longer, so there is time to read and click
    duration: options.duration ?? (tone === 'error' || options.action ? 7000 : 4000),
  };
  items = [...items.slice(-3), item]; // at most 4 at once
  emit();
  return item.id;
}

export function toast(message: string, options?: Options) {
  return show(message, 'info', options);
}
toast.success = (message: string, options?: Options) => show(message, 'success', options);
toast.error = (message: string, options?: Options) => show(message, 'error', options);
toast.dismiss = dismiss;

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const EMPTY: ToastItem[] = [];

export default function Toaster() {
  const list = useSyncExternalStore(subscribe, () => items, () => EMPTY);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-20 lg:bottom-6 z-[70] flex flex-col items-center sm:items-end gap-2 px-4 sm:px-6 print:hidden"
    >
      {list.map((t) => (
        <ToastCard key={t.id} item={t} />
      ))}
    </div>
  );
}

const TONES: Record<Tone, { icon: typeof Info; className: string }> = {
  success: { icon: CheckCircle2, className: 'text-emerald-700' },
  error: { icon: XCircle, className: 'text-red-700' },
  info: { icon: Info, className: 'text-maroon' },
};

function ToastCard({ item }: { item: ToastItem }) {
  const [hovered, setHovered] = useState(false);
  // Auto-close, but not while the pointer is on it (so the Undo button can be reached)
  useEffect(() => {
    if (hovered) return;
    const timer = setTimeout(() => dismiss(item.id), item.duration);
    return () => clearTimeout(timer);
  }, [hovered, item.id, item.duration]);

  const { icon: Icon, className } = TONES[item.tone];
  return (
    <div
      role={item.tone === 'error' ? 'alert' : 'status'}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setHovered(true)}
      onBlurCapture={() => setHovered(false)}
      className="animate-toast-in pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-stone-200/90 bg-white p-3.5 pr-2 text-sm text-stone-950 shadow-lg"
    >
      <Icon className={`mt-0.5 size-5 shrink-0 ${className}`} aria-hidden="true" />
      <p className="flex-1 font-semibold leading-snug break-words">{item.message}</p>
      {item.action && (
        <button
          type="button"
          onClick={() => {
            item.action?.onClick();
            dismiss(item.id);
          }}
          className="shrink-0 rounded-lg px-2 py-1 text-xs font-black uppercase tracking-widest text-maroon hover:bg-stone-100 cursor-pointer"
        >
          {item.action.label}
        </button>
      )}
      <button
        type="button"
        onClick={() => dismiss(item.id)}
        aria-label="Close message"
        className="shrink-0 rounded-lg p-1 text-stone-500 hover:bg-stone-100 hover:text-stone-950 cursor-pointer"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
