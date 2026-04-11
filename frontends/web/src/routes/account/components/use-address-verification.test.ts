// SPDX-License-Identifier: Apache-2.0

import '../../../../__mocks__/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/i18n/i18n');
vi.mock('./verify-address');
vi.mock('@/api/backend', () => ({
  cancelConnectKeystore: vi.fn().mockResolvedValue(undefined),
}));

import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { act, renderHook, waitFor } from '@testing-library/react';
import * as accountApi from '@/api/account';
import { verifyAddressWithDevice, handleVerifyAddressWithDeviceResult } from './verify-address';
import { useAddressVerification } from './use-address-verification';

const mockUsedAddress: accountApi.TUsedAddress = {
  address: 'bc1qtest',
  addressID: 'addr-1',
  addressType: 'receive',
  canSignMsg: true,
  lastUsed: '2025-01-12T10:00:00Z',
};

const defaultParams = {
  code: 'btc-acct' as accountApi.AccountCode,
  rootFingerprint: 'aabbccdd',
  selectedAddress: mockUsedAddress,
  isVerifyView: false,
  returnToList: vi.fn(),
};

const COPY_ONLY_PARAM = 'copyOnly';

const createWrapper = (initialEntry = '/account/btc-acct/addresses/addr-1/verify') => (
  ({ children }: { children: React.ReactNode }) => (
    React.createElement(MemoryRouter, {
      initialEntries: [initialEntry],
    }, children)
  )
);

const wrapper = createWrapper();

describe('routes/account/components/use-address-verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultParams.returnToList = vi.fn();
  });

  it('starts in idle state when not verify view', () => {
    const { result } = renderHook(
      () => useAddressVerification({ ...defaultParams, isVerifyView: false }),
      { wrapper },
    );

    expect(result.current.verifyState).toBe('idle');
    expect(result.current.verifyError).toBeNull();
    expect(verifyAddressWithDevice).not.toHaveBeenCalled();
  });

  it('starts verification when in verify view with all params', async () => {
    vi.mocked(verifyAddressWithDevice).mockResolvedValue('verified' as any);
    vi.mocked(handleVerifyAddressWithDeviceResult).mockImplementation((_result, handlers) => {
      handlers.onVerified();
    });

    renderHook(
      () => useAddressVerification({ ...defaultParams, isVerifyView: true }),
      { wrapper },
    );

    await waitFor(() => {
      expect(verifyAddressWithDevice).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'btc-acct',
          addressID: 'addr-1',
          rootFingerprint: 'aabbccdd',
        }),
      );
    });

    await waitFor(() => {
      expect(handleVerifyAddressWithDeviceResult).toHaveBeenCalled();
    });

    // onVerified calls returnToList directly.
    await waitFor(() => {
      expect(defaultParams.returnToList).toHaveBeenCalledWith('addr-1');
    });
  });

  it('does not start when rootFingerprint is missing', () => {
    const { result } = renderHook(
      () => useAddressVerification({
        ...defaultParams,
        isVerifyView: true,
        rootFingerprint: undefined,
      }),
      { wrapper },
    );

    expect(result.current.verifyState).toBe('idle');
    expect(verifyAddressWithDevice).not.toHaveBeenCalled();
  });

  it('does not start when selectedAddress is null', () => {
    const { result } = renderHook(
      () => useAddressVerification({
        ...defaultParams,
        isVerifyView: true,
        selectedAddress: null,
      }),
      { wrapper },
    );

    expect(result.current.verifyState).toBe('idle');
    expect(verifyAddressWithDevice).not.toHaveBeenCalled();
  });

  it('retryVerify resets state and triggers re-verification', async () => {
    vi.mocked(verifyAddressWithDevice).mockResolvedValue('connectFailed' as any);
    vi.mocked(handleVerifyAddressWithDeviceResult).mockImplementation((_result, handlers) => {
      handlers.onConnectFailed();
    });

    const { result } = renderHook(
      () => useAddressVerification({ ...defaultParams, isVerifyView: true }),
      { wrapper },
    );

    // Wait for initial verification to complete with connectFailed
    await waitFor(() => {
      expect(result.current.verifyState).toBe('connectFailed');
    });

    expect(verifyAddressWithDevice).toHaveBeenCalledTimes(1);

    // Now set mock to succeed on next call
    vi.mocked(verifyAddressWithDevice).mockResolvedValue('verified' as any);
    vi.mocked(handleVerifyAddressWithDeviceResult).mockImplementation((_result, handlers) => {
      handlers.onVerified();
    });

    act(() => {
      result.current.retryVerify();
    });

    await waitFor(() => {
      expect(verifyAddressWithDevice).toHaveBeenCalledTimes(2);
    });
  });

  it('skipVerify sets state to skipped', async () => {
    const { result } = renderHook(
      () => useAddressVerification({ ...defaultParams, isVerifyView: false }),
      { wrapper },
    );

    expect(result.current.verifyState).toBe('idle');

    act(() => {
      result.current.skipVerify();
    });

    expect(result.current.verifyState).toBe('skipped');
  });

  it('goes straight to skipped state in copy-only mode without verifying', async () => {
    const { result } = renderHook(
      () => useAddressVerification({ ...defaultParams, isVerifyView: true }),
      {
        wrapper: createWrapper(`/account/btc-acct/addresses/addr-1/verify?${COPY_ONLY_PARAM}=1`),
      },
    );

    await waitFor(() => {
      expect(result.current.verifyState).toBe('skipped');
    });
    expect(verifyAddressWithDevice).not.toHaveBeenCalled();
    expect(handleVerifyAddressWithDeviceResult).not.toHaveBeenCalled();
  });

  it('startVerifyFlow navigates to verify route', () => {
    const { result } = renderHook(
      () => useAddressVerification({ ...defaultParams, isVerifyView: false }),
      { wrapper },
    );

    act(() => {
      result.current.startVerifyFlow('addr-1');
    });

    // startVerifyFlow resets state and increments attempt counter
    expect(result.current.verifyState).toBe('idle');
    expect(result.current.verifyError).toBeNull();
    // Navigation is handled internally by react-router; we verify it doesn't throw
    // and that the state is properly reset for the new flow.
  });

  it('startCopyOnlyFlow resets state for the copy-only route', () => {
    const { result } = renderHook(
      () => useAddressVerification({ ...defaultParams, isVerifyView: false }),
      { wrapper },
    );

    act(() => {
      result.current.startCopyOnlyFlow('addr-1');
    });

    expect(result.current.verifyState).toBe('idle');
    expect(result.current.verifyError).toBeNull();
  });
});
