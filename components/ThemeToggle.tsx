'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import Tooltip from '@/components/Tooltip';
import { applyThemeChoice, nextThemeChoice, readThemeChoice, type ThemeChoice } from '@/utils/theme';

const labels: Record<ThemeChoice, string> = {
  system: 'Theme: same as your device. Click for light.',
  light: 'Theme: light. Click for dark.',
  dark: 'Theme: dark. Click to follow your device.',
};

// The saved choice, read through useSyncExternalStore (the server renders "system")
const listeners = new Set<() => void>();
function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
}
function choose(choice: ThemeChoice) {
  applyThemeChoice(choice);
  listeners.forEach((notify) => notify());
}

// Header button: system -> light -> dark. The choice is saved on this device (utils/theme.ts).
export default function ThemeToggle() {
  const choice = useSyncExternalStore(subscribe, readThemeChoice, () => 'system' as ThemeChoice);

  // While following the device, switch when the device setting changes
  useEffect(() => {
    if (choice !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyThemeChoice('system');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [choice]);

  const Icon = choice === 'dark' ? Moon : choice === 'light' ? Sun : Monitor;

  return (
    <Tooltip text={labels[choice]} side="bottom">
      <button
        type="button"
        onClick={() => choose(nextThemeChoice(choice))}
        aria-label={labels[choice]}
        className="w-10 h-10 flex items-center justify-center rounded-xl border border-stone-200 bg-white hover:bg-stone-50 hover:border-stone-300 text-stone-700 hover:text-stone-950 shadow-xs transition-colors cursor-pointer"
      >
        <Icon className="h-5 w-5" />
      </button>
    </Tooltip>
  );
}
