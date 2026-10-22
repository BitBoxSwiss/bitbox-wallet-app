// SPDX-License-Identifier: Apache-2.0

import '../../../../__mocks__/i18n';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TAccount } from '@/api/account';
import * as lightningApi from '@/api/lightning';
import * as lightningHook from '@/hooks/lightning';
import { useLightningRecipient } from './use-lightning-recipient';

const account = { code: 'btc-account', coinCode: 'btc' } as TAccount;
const ready = {
  lightningAccount: { code: 'lightning', rootFingerprint: '1234', num: 0 },
  isLightningReady: true,
  lightningSDKStatus: 'ready' as const,
};

describe('useLightningRecipient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(lightningHook, 'useLightning').mockReturnValue(ready);
  });

  // Fetch on explicit selection; resetting and selecting again also retries a failed lookup.
  it('loads the selected wallet address and allows retry after reset', async () => {
    const getAddress = vi.spyOn(lightningApi, 'getBoardingAddress')
      .mockRejectedValueOnce(new Error('Address unavailable'))
      .mockResolvedValueOnce('bc1qboarding');
    const { result } = renderHook(() => useLightningRecipient(account));
    expect(getAddress).not.toHaveBeenCalled();
    act(() => result.current.select());
    await waitFor(() => expect(result.current.recipient).toEqual({ error: 'Address unavailable' }));
    act(() => result.current.reset());
    expect(result.current.recipient).toBeNull();
    act(() => result.current.select());
    await waitFor(() => expect(result.current.recipient).toEqual({ address: 'bc1qboarding' }));
  });

  // A pending lookup must not restore Lightning after reset or a wallet change.
  it.each(['reset', 'wallet change'])('discards a pending address after %s', async change => {
    let resolve!: (address: string) => void;
    vi.spyOn(lightningApi, 'getBoardingAddress').mockReturnValue(new Promise(done => {
      resolve = done;
    }));
    const { result, rerender } = renderHook(() => useLightningRecipient(account));
    act(() => result.current.select());
    expect(result.current.recipient).toBeUndefined();
    if (change === 'reset') {
      act(() => result.current.reset());
    } else {
      vi.mocked(lightningHook.useLightning).mockReturnValue({
        ...ready, lightningAccount: { ...ready.lightningAccount, rootFingerprint: '5678' },
      });
      rerender();
    }
    await act(async () => resolve('bc1qstale'));
    expect(result.current.recipient).toBeNull();
  });
});
