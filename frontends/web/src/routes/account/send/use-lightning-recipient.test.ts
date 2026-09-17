// SPDX-License-Identifier: Apache-2.0

import '../../../../__mocks__/i18n';
import { act, renderHook } from '@testing-library/react';
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

  it('fetches only on selection and discards a response after Reset', async () => {
    let resolve!: (address: string) => void;
    const getAddress = vi.spyOn(lightningApi, 'getBoardingAddress').mockReturnValue(new Promise(done => {
      resolve = done;
    }));
    const { result } = renderHook(() => useLightningRecipient(account));
    expect(getAddress).not.toHaveBeenCalled();
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.select();
    });
    expect(result.current.recipient).toBeUndefined();
    act(() => result.current.reset());
    await act(async () => {
      resolve('bc1qboarding');
      await pending;
    });
    expect(result.current.recipient).toBeNull();
  });

  it('keeps failures in Lightning mode and allows retry', async () => {
    vi.spyOn(lightningApi, 'getBoardingAddress')
      .mockRejectedValueOnce(new Error('Address unavailable'))
      .mockResolvedValueOnce('bc1qboarding');
    const { result } = renderHook(() => useLightningRecipient(account));
    await act(() => result.current.select());
    expect(result.current.recipient).toEqual({ error: 'Address unavailable' });
    await act(() => result.current.select());
    expect(result.current.recipient).toEqual({ address: 'bc1qboarding' });
  });

  it.each(['source', 'wallet', 'disabled', 'unmount'])('discards pending address when %s changes', async change => {
    let resolve!: (address: string) => void;
    vi.spyOn(lightningApi, 'getBoardingAddress').mockReturnValue(new Promise(done => {
      resolve = done;
    }));
    const { result, rerender, unmount } = renderHook(({ source }) => useLightningRecipient(source), {
      initialProps: { source: account },
    });
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.select();
    });
    if (change === 'unmount') {
      unmount();
    } else {
      if (change === 'wallet') {
        vi.mocked(lightningHook.useLightning).mockReturnValue({
          ...ready, lightningAccount: { ...ready.lightningAccount, code: 'other-wallet' },
        });
      } else if (change === 'disabled') {
        vi.mocked(lightningHook.useLightning).mockReturnValue({
          lightningAccount: null, isLightningReady: false, lightningSDKStatus: 'inactive',
        });
      }
      rerender({ source: change === 'source' ? { ...account, code: 'other-btc' } : account });
      expect(result.current.recipient).toBeNull();
    }
    await act(async () => {
      resolve('bc1qstale');
      await pending;
    });
    expect(result.current.recipient?.address).toBeUndefined();
  });

  it('requires mainnet BTC, an enabled wallet, and a ready SDK', async () => {
    const getAddress = vi.spyOn(lightningApi, 'getBoardingAddress');
    const { result, rerender } = renderHook(({ source }) => useLightningRecipient(source), {
      initialProps: { source: { ...account, coinCode: 'tbtc' } as TAccount },
    });
    expect(result.current.available).toBe(false);
    await act(() => result.current.select());
    vi.mocked(lightningHook.useLightning).mockReturnValue({
      ...ready, isLightningReady: undefined, lightningSDKStatus: undefined,
    });
    rerender({ source: account });
    expect(result.current.available).toBe(true);
    expect(result.current.ready).toBe(false);
    await act(() => result.current.select());
    expect(getAddress).not.toHaveBeenCalled();
  });
});
