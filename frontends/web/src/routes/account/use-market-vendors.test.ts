// SPDX-License-Identifier: Apache-2.0

import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as marketApi from '@/api/market';
import type { MarketVendors } from '@/api/market';
import { useMarketVendors } from './use-market-vendors';

describe('useMarketVendors', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps cached vendors visible while revalidating after a remount', async () => {
    const vendors: MarketVendors = { vendors: ['pocket'] };
    const getVendors = vi.spyOn(marketApi, 'getMarketVendors');
    getVendors.mockReturnValue(() => Promise.resolve(vendors));

    const firstRender = renderHook(() => useMarketVendors('vendor-cache-test'));
    expect(firstRender.result.current).toBeUndefined();
    await waitFor(() => expect(firstRender.result.current).toBe(vendors));
    firstRender.unmount();

    const pendingVendors = new Promise<MarketVendors>(() => {});
    getVendors.mockReturnValue(() => pendingVendors);

    const secondRender = renderHook(() => useMarketVendors('vendor-cache-test'));
    expect(secondRender.result.current).toBe(vendors);
    expect(getVendors).toHaveBeenCalledTimes(2);
  });
});
