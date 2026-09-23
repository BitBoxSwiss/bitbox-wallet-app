// SPDX-License-Identifier: Apache-2.0

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { postEthAccountActivity } from '@/api/account';
import { useEthAccountActivity } from './account-activity';

vi.mock('@/api/account', () => ({
  postEthAccountActivity: vi.fn(() => Promise.resolve({ success: true })),
}));

const mockPostEthAccountActivity = vi.mocked(postEthAccountActivity);

describe('useEthAccountActivity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renews activity while visible and stops while hidden or unmounted', () => {
    vi.useFakeTimers();
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    const { unmount } = renderHook(() => (
      useEthAccountActivity('account-code', 'eth')
    ));

    expect(mockPostEthAccountActivity).toHaveBeenCalledExactlyOnceWith('account-code', true);
    act(() => vi.advanceTimersByTime(30_000));
    expect(mockPostEthAccountActivity).toHaveBeenCalledTimes(2);
    expect(mockPostEthAccountActivity).toHaveBeenLastCalledWith('account-code', true);

    visibility.mockReturnValue('hidden');
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(mockPostEthAccountActivity).toHaveBeenLastCalledWith('account-code', false);
    act(() => vi.advanceTimersByTime(60_000));
    expect(mockPostEthAccountActivity).toHaveBeenCalledTimes(3);

    visibility.mockReturnValue('visible');
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(mockPostEthAccountActivity).toHaveBeenLastCalledWith('account-code', true);

    unmount();
    expect(mockPostEthAccountActivity).toHaveBeenLastCalledWith('account-code', false);
    act(() => {
      vi.advanceTimersByTime(30_000);
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(mockPostEthAccountActivity).toHaveBeenCalledTimes(5);
  });

  it('marks ERC20 accounts active while mounted', async () => {
    renderHook(() => (
      useEthAccountActivity('account-code', 'eth-erc20-usdc')
    ));

    await waitFor(() => {
      expect(mockPostEthAccountActivity).toHaveBeenCalledWith('account-code', true);
    });
  });

  it('ignores non-Ethereum accounts', () => {
    renderHook(() => (
      useEthAccountActivity('account-code', 'btc')
    ));

    expect(mockPostEthAccountActivity).not.toHaveBeenCalled();
  });

  it('ignores missing account data', () => {
    renderHook(() => (
      useEthAccountActivity('account-code', undefined)
    ));

    expect(mockPostEthAccountActivity).not.toHaveBeenCalled();
  });
});
