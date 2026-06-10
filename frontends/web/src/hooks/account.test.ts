// SPDX-License-Identifier: Apache-2.0

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { useAccountSynced } from './account';
import { syncdone } from '@/api/accountsync';
import * as utils from './mount';

vi.mock('@/api/accountsync', () => ({
  syncdone: vi.fn(() => () => {}),
}));

const mockSyncdone = vi.mocked(syncdone);

const useMountedRefSpy = vi.spyOn(utils, 'useMountedRef');

describe('useAccountSynced', () => {
  beforeEach(() => {
    useMountedRefSpy.mockReturnValue({ current: true });
    vi.clearAllMocks();
  });

  it('returns undefined while loading', () => {
    const mockApiCall = vi.fn().mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => (
      useAccountSynced('account-code-1' as any, mockApiCall)
    ));

    expect(result.current).toBeUndefined();
  });

  it('returns api result on success', async () => {
    const mockApiCall = vi.fn().mockResolvedValue('result');

    const { result } = renderHook(() => (
      useAccountSynced('account-code-1' as any, mockApiCall)
    ));

    await waitFor(() => expect(result.current).toBe('result'));

    expect(mockApiCall).toHaveBeenCalledTimes(1);
    expect(mockSyncdone).toHaveBeenCalledWith(
      'account-code-1',
      expect.any(Function),
    );
  });

  it('clears previous result when code changes', async () => {
    let resolveApiCall: ((value: string) => void) | undefined;

    const mockApiCall = vi.fn().mockImplementation(() => (
      new Promise<string>((resolve) => {
        resolveApiCall = resolve;
      })
    ));

    const { result } = renderHook(() => {
      const [code, setCode] = useState('account-code-1');

      const value = useAccountSynced(
        code as any,
        mockApiCall,
      );

      return {
        value,
        setCode,
      };
    });

    act(() => {
      resolveApiCall?.('result-1');
    });

    await waitFor(() => {
      expect(result.current.value).toBe('result-1');
    });

    act(() => {
      result.current.setCode('account-code-2');
    });

    expect(result.current.value).toBeUndefined();

    act(() => {
      resolveApiCall?.('result-2');
    });

    await waitFor(() => {
      expect(result.current.value).toBe('result-2');
    });

    expect(mockApiCall).toHaveBeenCalledTimes(2);
  });

  it('ignores stale api responses', async () => {
    let resolveFirst: ((value: string) => void) | undefined;
    let resolveSecond: ((value: string) => void) | undefined;

    const mockApiCall = vi
      .fn()
      .mockImplementationOnce(() => (
        new Promise<string>((resolve) => {
          resolveFirst = resolve;
        })
      ))
      .mockImplementationOnce(() => (
        new Promise<string>((resolve) => {
          resolveSecond = resolve;
        })
      ));

    const { result } = renderHook(() => {
      const [code, setCode] = useState('account-code-1');

      const value = useAccountSynced(
        code as any,
        mockApiCall,
      );

      return {
        value,
        setCode,
      };
    });

    act(() => {
      result.current.setCode('account-code-2');
    });

    act(() => {
      resolveFirst?.('stale-result');
    });

    expect(result.current.value).toBeUndefined();

    act(() => {
      resolveSecond?.('fresh-result');
    });

    await waitFor(() => {
      expect(result.current.value).toBe('fresh-result');
    });

    expect(result.current.value).not.toBe('stale-result');
  });
});
