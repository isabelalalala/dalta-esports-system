import { useEffect } from 'react';

// Client components can't export metadata — this sets the tab title to match
// the layout's "%s – DALTA Esports" template. Server pages use export const metadata.
export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} – DALTA Esports`;
  }, [title]);
}
