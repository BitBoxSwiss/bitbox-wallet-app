// SPDX-License-Identifier: Apache-2.0

import { useEffect } from 'react';
import * as accountApi from '@/api/account';

const activityRefreshMs = 30_000;

export const useAccountActivity = (
  code: accountApi.AccountCode,
  enabled = true,
) => {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const setActive = (active: boolean) => {
      accountApi.setAccountActivity(code, active).catch(console.error);
    };

    const refresh = () => {
      if (document.visibilityState === 'visible') {
        setActive(true);
      }
    };

    const handleVisibilityChange = () => {
      setActive(document.visibilityState === 'visible');
    };

    refresh();
    const intervalID = window.setInterval(refresh, activityRefreshMs);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(intervalID);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      setActive(false);
    };
  }, [code, enabled]);
};
