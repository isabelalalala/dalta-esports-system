import { useEffect, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';

// Pages can give their breadcrumb a real name once their data has loaded, e.g. a team page shows
// "Home > Teams > Fuego Alta" instead of "... > Team". Kept in memory for this visit.

let names: Record<string, string> = {};
const listeners = new Set<() => void>();

function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
}

// Call from a page: useBreadcrumbName(team?.name)
export function useBreadcrumbName(label: string | null | undefined) {
  const pathname = usePathname();
  useEffect(() => {
    if (!label || !pathname || names[pathname] === label) return;
    names = { ...names, [pathname]: label };
    listeners.forEach((notify) => notify());
  }, [label, pathname]);
}

const EMPTY: Record<string, string> = {};

export function useBreadcrumbNames(): Record<string, string> {
  return useSyncExternalStore(subscribe, () => names, () => EMPTY);
}
