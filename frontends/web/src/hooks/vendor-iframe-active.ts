// SPDX-License-Identifier: Apache-2.0

import { useContext, useEffect } from 'react';
import { AppContext } from '@/contexts/AppContext';

export const useMarketIframeActive = (active: boolean) => {
  const { setMarketIframeActive } = useContext(AppContext);

  useEffect(() => {
    setMarketIframeActive?.(active);
    return () => setMarketIframeActive?.(false);
  }, [active, setMarketIframeActive]);
};
