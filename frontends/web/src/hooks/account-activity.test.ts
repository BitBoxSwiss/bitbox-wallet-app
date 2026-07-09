// SPDX-License-Identifier: Apache-2.0

import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

  it('marks Ethereum accounts active while mounted', async () => {
    const { unmount } = renderHook(() => (
      useEthAccountActivity('account-code', 'eth')
    ));

    await waitFor(() => {
      expect(mockPostEthAccountActivity).toHaveBeenCalledWith('account-code', true);
    });

    unmount();

    expect(mockPostEthAccountActivity).toHaveBeenLastCalledWith('account-code', false);
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
