// SPDX-License-Identifier: Apache-2.0

import { useContext, useEffect } from 'react';
import { AppContext } from '@/contexts/AppContext';

export const useVendorIframeActive = (active: boolean) => {
  const { setVendorIframeActive } = useContext(AppContext);

  useEffect(() => {
    setVendorIframeActive?.(active);
    return () => setVendorIframeActive?.(false);
  }, [active, setVendorIframeActive]);
};

export const useMarketIframeActive = useVendorIframeActive;
