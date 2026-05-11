// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useRef, useState } from 'react';
import { syncdone } from '@/api/accountsync';
import { useMountedRef } from './mount';

export const useAccountSynced = <T, >(
  code: string,
  apiCall: () => Promise<T>,
): T | undefined => {
  const isMounted = useMountedRef();
  const apiRequestId = useRef(0);
  const [result, setResult] = useState<T | undefined>(undefined);

  const callApi = useCallback(async () => {
    const requestId = ++apiRequestId.current;
    try {
      const response = await apiCall();
      if (
        isMounted.current
        && requestId === apiRequestId.current
      ) {
        setResult(response);
      }
    } catch (error) {
      console.error(error);
    }
  }, [apiCall, isMounted]);

  useEffect(() => {
    callApi();
    return syncdone(code, callApi);
  }, [code, callApi]);

  return result;
};
