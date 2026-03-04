// SPDX-License-Identifier: Apache-2.0

import '../../../../../__mocks__/i18n';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/i18n/i18n');
vi.mock('@/api/account');

import * as accountApi from '@/api/account';
import { useSignMessage } from './use-sign-message';

const mockAddress: accountApi.TReceiveAddress = { addressID: 'test-addr-id', address: 'bc1qtest' };

describe('routes/account/receive/components/use-sign-message', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('initializes with default state', () => {
    const { result } = renderHook(() => useSignMessage({
      accountCode: 'btc-acc' as accountApi.AccountCode,
      address: mockAddress,
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
  });

  it('handles userAbort by calling onClose', async () => {
    vi.mocked(accountApi.signBTCMessageForAddress).mockResolvedValue({
      success: false,
      errorCode: 'userAbort',
    });
    const onClose = vi.fn();

    const { result } = renderHook(() => useSignMessage({
      accountCode: 'btc-acc' as accountApi.AccountCode,
      address: mockAddress,
      onClose,
    }));

    act(() => {
      result.current.setMessage('some message');
    });

    await act(async () => {
      await result.current.handleSign();
    });

    expect(onClose).toHaveBeenCalled();
    expect(result.current.state).toBe('input');
    expect(result.current.error).toBeNull();
  });

  it('handles wrongKeystore error', async () => {
    vi.mocked(accountApi.signBTCMessageForAddress).mockResolvedValue({
      success: false,
      errorCode: 'wrongKeystore',
    });

    const { result } = renderHook(() => useSignMessage({
      accountCode: 'btc-acc' as accountApi.AccountCode,
      address: mockAddress,
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

  it('handles API exception', async () => {
    vi.mocked(accountApi.signBTCMessageForAddress).mockRejectedValue(new Error('network error'));

    const { result } = renderHook(() => useSignMessage({
      accountCode: 'btc-acc' as accountApi.AccountCode,
      address: mockAddress,
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
      () => new Promise((resolve) => { resolveSign = resolve; }),
    );

    const { result } = renderHook(() => useSignMessage({
      accountCode: 'btc-acc' as accountApi.AccountCode,
      address: mockAddress,
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

    // Resolve the pending sign and let the first call complete
    await act(async () => {
      resolveSign!({ success: true, signature: 'sig', address: 'bc1qtest' });
      await firstCall!;
    });

    expect(accountApi.signBTCMessageForAddress).toHaveBeenCalledTimes(1);
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
      scriptType: 'p2tr',
    }));

    expect(result.current.isTaprootAddress).toBe(true);
  });
});
