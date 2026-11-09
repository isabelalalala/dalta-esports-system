'use client';

import { useCallback, useState } from 'react';

// Filters that live in the address (?tab=ongoing&tournament=...), so the browser's Back button,
// a refresh or a shared link brings back the same view. Changing a filter replaces the current
// history entry (it doesn't add one per click). Next.js keeps useSearchParams() in sync with
// window.history.replaceState. Default values are left out of the address to keep it short.

// Sets (or removes, for null / '') query parameters without navigating
export function setUrlParams(params: Record<string, string | null | undefined>) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') url.searchParams.delete(key);
    else url.searchParams.set(key, value);
  }
  window.history.replaceState(null, '', url);
}

// Reads a query parameter once (client only; '' on the server)
export function readUrlParam(key: string): string {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get(key) ?? '';
}

// useState backed by one query parameter. Use it on pages that show a loading screen first (the
// first render then matches the server's), or read the value from useSearchParams() instead.
export function useUrlState<T extends string>(key: string, fallback: T, allowed?: readonly T[]): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(() => {
    const raw = readUrlParam(key) as T;
    if (!raw) return fallback;
    return allowed && !allowed.includes(raw) ? fallback : raw;
  });
  const update = useCallback((next: T) => {
    setValue(next);
    setUrlParams({ [key]: next === fallback ? null : next });
  }, [key, fallback]);
  return [value, update];
}
