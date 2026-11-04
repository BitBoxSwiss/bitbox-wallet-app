// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react';
import { getStatus, type AccountCode, type TStatus } from '@/api/account';
import { statusChanged, syncdone } from '@/api/accountsync';
import { useMountedRef } from './mount';

// Keep the accountCodes array stable between renders. Missing entries are still loading.
export const useAccountStatuses = (accountCodes: readonly AccountCode[]) => {
  const mounted = useMountedRef();
  const [statuses, setStatuses] = useState<Partial<Record<AccountCode, TStatus>>>({});

  useEffect(() => {
    let active = true;
    setStatuses({});
    const subscriptions = accountCodes.flatMap(code => {
      let request = 0;
      const load = async () => {
        if (!active || !mounted.current) {
          return;
        }
        const currentRequest = ++request;
        try {
          const status = await getStatus(code);
          if (active && mounted.current && currentRequest === request) {
            setStatuses(previous => ({ ...previous, [code]: status }));
          }
        } catch (error) {
          console.error(error);
        }
      };

      // Subscribe before loading so a sync completion cannot be missed during the request.
      const unsubscribes = [statusChanged(code, load), syncdone(code, load)];
      load();
      return unsubscribes;
    });
    return () => {
      active = false;
      subscriptions.forEach(unsubscribe => unsubscribe());
    };
  }, [accountCodes, mounted]);

  return statuses;
};
