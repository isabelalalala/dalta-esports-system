'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { refreshViewer, useViewer } from '@/utils/use-viewer';
import { tourSteps } from '@/utils/tour';

// Remembered on this device too, so a failed save doesn't bring the tour back on every page load
const LOCAL_KEY = 'dalta_tour_dismissed';

function dismissedHere() {
  try {
    return localStorage.getItem(LOCAL_KEY) === '1';
  } catch {
    return false;
  }
}

// First-login quick tour (4 steps, role-specific; utils/tour.ts). Shown on the dashboard until it
// is finished or skipped, then never again: profiles.tour_dismissed_at is set for the account.
export default function QuickTour() {
  const viewer = useViewer();
  const [step, setStep] = useState(0);
  const [closed, setClosed] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);

  const show = viewer.status === 'ready' && !!viewer.userId && !viewer.tourDismissed && !closed;
  const steps = tourSteps(viewer.role);

  useEffect(() => {
    const dialog = ref.current;
    if (show && dialog && !dialog.open && !dismissedHere()) dialog.showModal();
  }, [show]);

  if (!show) return null;

  const finish = async () => {
    setClosed(true);
    ref.current?.close();
    try {
      localStorage.setItem(LOCAL_KEY, '1');
    } catch {
      // Storage blocked: the account flag below still works
    }
    if (viewer.userId) {
      await createClient()
        .from('profiles')
        .update({ tour_dismissed_at: new Date().toISOString() })
        .eq('id', viewer.userId);
      refreshViewer().catch(() => undefined);
    }
  };

  const current = steps[step];
  const last = step === steps.length - 1;

  return (
    <dialog
      ref={ref}
      aria-labelledby="tour-title"
      aria-describedby="tour-text"
      onCancel={(e) => {
        // Esc = skip
        e.preventDefault();
        finish();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-stone-200/90 bg-white p-0 text-stone-950 shadow-xl backdrop:bg-stone-950/60"
    >
      <div className="p-5 sm:p-6 space-y-4">
        <p className="text-xs font-black uppercase tracking-widest text-maroon">
          Quick tour · {step + 1} of {steps.length}
        </p>
        <h2 id="tour-title" className="text-lg font-black uppercase tracking-wide">{current.title}</h2>
        <p id="tour-text" className="text-base leading-relaxed text-stone-800">{current.text}</p>

        {/* Progress dots */}
        <div className="flex gap-1.5" aria-hidden="true">
          {steps.map((_, i) => (
            <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-gold' : 'bg-stone-200'}`} />
          ))}
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2 pt-1">
          <button
            type="button"
            onClick={finish}
            className="px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-stone-600 hover:text-stone-950 cursor-pointer"
          >
            Skip tour
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-stone-300 bg-white text-xs font-black uppercase tracking-widest cursor-pointer"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={() => (last ? finish() : setStep((s) => s + 1))}
              autoFocus
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-gold hover:bg-golddark text-stone-950 text-xs font-black uppercase tracking-widest cursor-pointer"
            >
              {last ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
