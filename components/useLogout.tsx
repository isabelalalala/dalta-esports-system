'use client';

import { useCallback, type ReactNode } from 'react';
import { createClient } from '@/utils/supabase/client';
import { reloadTo } from '@/utils/auth';
import { useConfirm } from '@/components/useConfirm';

// Phones and tablets (below the lg breakpoint, where the bottom bar is shown): Log out sits next to
// other tappable things, so it asks first. On desktops a click logs out straight away.
const TOUCH_LAYOUT = '(width < 64rem)';

// The one Log out action (avatar menu in the header and the bottom bar's "More" sheet):
//   const [logoutDialog, logout] = useLogout();
//   <button onClick={logout}>Log out</button> ... and render {logoutDialog} once.
export function useLogout(): [ReactNode, () => Promise<void>] {
  const [dialog, ask] = useConfirm();

  const logout = useCallback(async () => {
    if (window.matchMedia(TOUCH_LAYOUT).matches) {
      const ok = await ask({
        title: 'Log out?',
        message: 'You will need your email and password to log in again.',
        confirmLabel: 'Log out',
      });
      if (!ok) return;
    }
    await createClient().auth.signOut();
    // A full load, so no page cached while logged in can be shown afterwards (see reloadTo)
    reloadTo('/');
  }, [ask]);

  return [dialog, logout];
}
