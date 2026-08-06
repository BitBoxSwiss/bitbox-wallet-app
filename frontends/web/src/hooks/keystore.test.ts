// SPDX-License-Identifier: Apache-2.0

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { connectAnyKeystore, connectKeystore } from '@/api/keystores';
import { useFeatureConnect } from './keystore';

vi.mock('@/api/keystores', () => ({
  connectAnyKeystore: vi.fn(),
  connectKeystore: vi.fn(),
}));

describe('useFeatureConnect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows and dismisses the firmware upgrade requirement', async () => {
    vi.mocked(connectKeystore).mockResolvedValue({
      success: false,
      errorCode: 'firmwareUpgradeRequired',
    });
    const { result } = renderHook(() => useFeatureConnect());

    let connected = true;
    await act(async () => {
      connected = await result.current.connect('root-fingerprint', 'messageSigning');
    });

    expect(connected).toBe(false);
    expect(connectKeystore).toHaveBeenCalledWith('root-fingerprint', 'messageSigning');
    expect(result.current.firmwareUpgradeRequired).toBe(true);

    act(() => result.current.dismissFirmwareUpgrade());
    expect(result.current.firmwareUpgradeRequired).toBe(false);
  });

  it('connects any supported keystore without showing an upgrade requirement', async () => {
    vi.mocked(connectAnyKeystore).mockResolvedValue({ success: true });
    const { result } = renderHook(() => useFeatureConnect());

    let connected = false;
    await act(async () => {
      connected = await result.current.connectAny('swapPaymentRequests');
    });

    expect(connected).toBe(true);
    expect(connectAnyKeystore).toHaveBeenCalledWith('swapPaymentRequests');
    expect(result.current.firmwareUpgradeRequired).toBe(false);
  });
});
