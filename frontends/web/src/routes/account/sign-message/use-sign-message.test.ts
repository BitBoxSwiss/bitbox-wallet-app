// SPDX-License-Identifier: Apache-2.0

import '../../../../__mocks__/i18n';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/i18n/i18n');
vi.mock('@/api/account');
vi.mock('@/api/keystores');

import * as accountApi from '@/api/account';
import * as keystoresApi from '@/api/keystores';
import { useSignMessage } from './use-sign-message';

const mockAddress: accountApi.TReceiveAddress = { addressID: 'test-addr-id', address: 'bc1qtest' };
const rootFingerprint = 'f23ab988';

describe('routes/account/sign-message/use-sign-message', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(keystoresApi.connectKeystore).mockResolvedValue({ success: true });
  });

  it('initializes with default state', () => {
    const { result } = renderHook(() => useSignMessage({
      accountCode: 'btc-acc' as accountApi.AccountCode,
      address: mockAddress,
      rootFingerprint,
    }));

    expect(result.current.state).toBe('input');
    expect(result.current.error).toBeNull();
    expect(result.current.result).toBeNull();
    expect(result.current.message).toBe('');
  });

  it('sets error on empty message', async () => {
    const { result } = renderHook(() => useSignMessage({
      accountCode: 'btc-acc' as accountApi.AccountCode,
      address: mockAddress,
      rootFingerprint,
    }));

    await act(async () => {
      await result.current.handleSign();
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.state).toBe('input');
  });

  it('signs BTC message successfully', async () => {
    vi.mocked(accountApi.signBTCMessageForAddress).mockResolvedValue({
      success: true,
      signature: 'btc-sig-123',
      address: 'bc1qtest',
    });

    const { result } = renderHook(() => useSignMessage({
      accountCode: 'btc-acc' as accountApi.AccountCode,
      address: mockAddress,
      rootFingerprint,
    }));

    act(() => {
      result.current.setMessage('test message');
    });

    await act(async () => {
      await result.current.handleSign();
    });

    await waitFor(() => {
      expect(result.current.state).toBe('result');
    });

    expect(result.current.result).toEqual({
      address: 'bc1qtest',
      message: 'test message',
      signature: 'btc-sig-123',
    });
    expect(accountApi.signBTCMessageForAddress).toHaveBeenCalledWith(
      'btc-acc',
      'test-addr-id',
      'test message',
    );
    expect(keystoresApi.connectKeystore).toHaveBeenCalledWith(rootFingerprint);
  });

  it('signs ETH message for ethereum-based coin', async () => {
    vi.mocked(accountApi.signETHMessageForAddress).mockResolvedValue({
      success: true,
      signature: 'eth-sig-456',
      address: '0xethaddr',
    });

    const ethAddress: accountApi.TReceiveAddress = { addressID: 'eth-addr-id', address: '0xethaddr' };

    const { result } = renderHook(() => useSignMessage({
      accountCode: 'eth-acc' as accountApi.AccountCode,
      coinCode: 'eth',
      address: ethAddress,
      rootFingerprint,
    }));

    act(() => {
      result.current.setMessage('eth test message');
    });

    await act(async () => {
      await result.current.handleSign();
    });

    await waitFor(() => {
      expect(result.current.state).toBe('result');
    });

    expect(accountApi.signETHMessageForAddress).toHaveBeenCalledWith(
      'eth-acc',
      'eth test message',
    );
    expect(accountApi.signBTCMessageForAddress).not.toHaveBeenCalled();
    expect(keystoresApi.connectKeystore).toHaveBeenCalledWith(rootFingerprint);
  });

  it('handles connect-keystore userAbort by returning to input', async () => {
    vi.mocked(keystoresApi.connectKeystore).mockResolvedValue({
      success: false,
      errorCode: 'userAbort',
    });

    const { result } = renderHook(() => useSignMessage({
      accountCode: 'btc-acc' as accountApi.AccountCode,
      address: mockAddress,
      rootFingerprint,
    }));

    act(() => {
      result.current.setMessage('some message');
    });

    await act(async () => {
      await result.current.handleSign();
    });

    expect(result.current.state).toBe('input');
    expect(result.current.error).toBeNull();
    expect(accountApi.signBTCMessageForAddress).not.toHaveBeenCalled();
  });

  it('returns silently when connect-keystore fails', async () => {
    vi.mocked(keystoresApi.connectKeystore).mockResolvedValue({ success: false });

    const { result } = renderHook(() => useSignMessage({
      accountCode: 'btc-acc' as accountApi.AccountCode,
      address: mockAddress,
      rootFingerprint,
    }));

    act(() => {
      result.current.setMessage('some message');
    });

    await act(async () => {
      await result.current.handleSign();
    });

    expect(result.current.state).toBe('input');
    expect(result.current.error).toBeNull();
    expect(accountApi.signBTCMessageForAddress).not.toHaveBeenCalled();
  });

  it('handles userAbort by returning to input', async () => {
    vi.mocked(accountApi.signBTCMessageForAddress).mockResolvedValue({
      success: false,
      errorCode: 'userAbort',
    });

    const { result } = renderHook(() => useSignMessage({
      accountCode: 'btc-acc' as accountApi.AccountCode,
      address: mockAddress,
      rootFingerprint,
    }));

    act(() => {
      result.current.setMessage('some message');
    });

    await act(async () => {
      await result.current.handleSign();
    });

    expect(result.current.state).toBe('input');
    expect(result.current.error).toBeNull();
  });

  it('handles generic sign error response', async () => {
    vi.mocked(accountApi.signBTCMessageForAddress).mockResolvedValue({
      success: false,
      errorMessage: 'sign failed',
    });

    const { result } = renderHook(() => useSignMessage({
      accountCode: 'btc-acc' as accountApi.AccountCode,
      address: mockAddress,
      rootFingerprint,
    }));

    act(() => {
      result.current.setMessage('some message');
    });

    await act(async () => {
      await result.current.handleSign();
    });

    expect(result.current.error).toBe('sign failed');
    expect(result.current.state).toBe('input');
  });

  it('handles API exception', async () => {
    vi.mocked(accountApi.signBTCMessageForAddress).mockRejectedValue(new Error('network error'));

    const { result } = renderHook(() => useSignMessage({
      accountCode: 'btc-acc' as accountApi.AccountCode,
      address: mockAddress,
      rootFingerprint,
    }));

    act(() => {
      result.current.setMessage('some message');
    });

    await act(async () => {
      await result.current.handleSign();
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.state).toBe('input');
  });

  it('prevents double submit', async () => {
    let resolveSign: (value: any) => void;
    vi.mocked(accountApi.signBTCMessageForAddress).mockImplementation(
      () => new Promise((resolve) => {
        resolveSign = resolve;
      }),
    );

    const { result } = renderHook(() => useSignMessage({
      accountCode: 'btc-acc' as accountApi.AccountCode,
      address: mockAddress,
      rootFingerprint,
    }));

    act(() => {
      result.current.setMessage('some message');
    });

    // Fire two handleSign calls rapidly without awaiting the first
    let firstCall: Promise<void>;
    act(() => {
      firstCall = result.current.handleSign();
      result.current.handleSign();
    });

    await waitFor(() => {
      expect(accountApi.signBTCMessageForAddress).toHaveBeenCalledTimes(1);
    });

    // Resolve the pending sign and let the first call complete
    await act(async () => {
      resolveSign!({ success: true, signature: 'sig', address: 'bc1qtest' });
      await firstCall!;
    });

    expect(keystoresApi.connectKeystore).toHaveBeenCalledTimes(1);
  });

  it('reset clears state', async () => {
    vi.mocked(accountApi.signBTCMessageForAddress).mockResolvedValue({
      success: true,
      signature: 'btc-sig',
      address: 'bc1qtest',
    });

    const { result } = renderHook(() => useSignMessage({
      accountCode: 'btc-acc' as accountApi.AccountCode,
      address: mockAddress,
      rootFingerprint,
    }));

    act(() => {
      result.current.setMessage('test message');
    });

    await act(async () => {
      await result.current.handleSign();
    });

    await waitFor(() => {
      expect(result.current.state).toBe('result');
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.message).toBe('');
    expect(result.current.state).toBe('input');
    expect(result.current.error).toBeNull();
    expect(result.current.result).toBeNull();
  });

  it('identifies taproot address', () => {
    const { result } = renderHook(() => useSignMessage({
      accountCode: 'btc-acc' as accountApi.AccountCode,
      address: mockAddress,
      rootFingerprint,
      scriptType: 'p2tr',
    }));

    expect(result.current.isTaprootAddress).toBe(true);
  });
});
