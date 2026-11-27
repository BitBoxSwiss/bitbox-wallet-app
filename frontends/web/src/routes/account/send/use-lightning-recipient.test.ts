// SPDX-License-Identifier: Apache-2.0

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TAccount } from '@/api/account';
import * as lightningHook from '@/hooks/lightning';
import { useLightningRecipient } from './use-lightning-recipient';

const account = { code: 'btc-account', coinCode: 'btc' } as TAccount;
const ready = {
  lightningAccount: { code: 'lightning', coinCode: 'lightning' as const, rootFingerprint: '1234', num: 0 },
  isLightningReady: true,
  lightningSDKStatus: 'ready' as const,
};

describe('useLightningRecipient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(lightningHook, 'useLightning').mockReturnValue(ready);
  });

  // Ordinary Send requires a new selection when its destination wallet changes.
  it('clears a manual Lightning selection on wallet change', () => {
    const { result, rerender } = renderHook(() => useLightningRecipient(account));
    act(() => result.current.select());
    expect(result.current.selected).toBe(true);
    vi.mocked(lightningHook.useLightning).mockReturnValue({
      ...ready, lightningAccount: { ...ready.lightningAccount, code: 'other-lightning', rootFingerprint: '5678' },
    });
    rerender();
    expect(result.current.selected).toBe(false);
  });

  // A locked recipient stays selected while the SDK starts, with proposals gated on readiness.
  it('keeps the fixed recipient selected until its wallet is ready', () => {
    vi.mocked(lightningHook.useLightning).mockReturnValue({ ...ready, isLightningReady: false });
    const { result, rerender } = renderHook(() => useLightningRecipient(account, true));
    expect(result.current.selected).toBe(true);
    expect(result.current.readyAccountCode).toBeUndefined();
    vi.mocked(lightningHook.useLightning).mockReturnValue(ready);
    rerender();
    expect(result.current.readyAccountCode).toBe(ready.lightningAccount.code);
  });
});
