// Light / dark theme (globals.css "DARK THEME"). The choice is saved per device in localStorage;
// "system" (the default) follows the device setting and keeps following it when it changes.

export type ThemeChoice = 'system' | 'light' | 'dark';

export const THEME_KEY = 'dalta_theme';

// Inline script for <head> in app/layout.tsx: sets <html data-theme> before the first paint.
// Kept tiny and wrapped in try: storage can be blocked (private browsing).
export const THEME_INIT_SCRIPT = `(function(){try{var c=localStorage.getItem('${THEME_KEY}');` +
  `var d=c==='dark'||(c!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);` +
  `document.documentElement.dataset.theme=d?'dark':'light';}catch(e){document.documentElement.dataset.theme='light';}})();`;

export function readThemeChoice(): ThemeChoice {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

export function resolveTheme(choice: ThemeChoice, systemDark: boolean): 'light' | 'dark' {
  if (choice === 'system') return systemDark ? 'dark' : 'light';
  return choice;
}

// The order the toggle button cycles through
export function nextThemeChoice(choice: ThemeChoice): ThemeChoice {
  return choice === 'system' ? 'light' : choice === 'light' ? 'dark' : 'system';
}

export function applyThemeChoice(choice: ThemeChoice) {
  try {
    if (choice === 'system') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, choice);
  } catch {
    // Storage blocked: the theme still changes for this visit
  }
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const root = document.documentElement;
  // A short color fade while switching (not on page load; respects reduced motion in CSS)
  root.classList.add('theme-transition');
  root.dataset.theme = resolveTheme(choice, systemDark);
  window.setTimeout(() => root.classList.remove('theme-transition'), 250);
}
