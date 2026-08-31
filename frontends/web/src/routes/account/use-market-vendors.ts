// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react';
import type { AccountCode } from '@/api/account';
import { getMarketVendors, type MarketVendors } from '@/api/market';
import { useMountedRef } from '@/hooks/mount';

const marketVendorsCache = new Map<AccountCode, MarketVendors>();

export const useMarketVendors = (code: AccountCode) => {
  const [vendors, setVendors] = useState(() => marketVendorsCache.get(code));
  const mounted = useMountedRef();

  useEffect(() => {
    getMarketVendors(code)().then(vendors => {
      marketVendorsCache.set(code, vendors);
      if (mounted.current) {
        setVendors(vendors);
      }
    }).catch(console.error);
  }, [code, mounted]);

  return vendors;
};
