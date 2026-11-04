// SPDX-License-Identifier: Apache-2.0

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getStatus, type TStatus } from '@/api/account';
import { statusChanged, syncdone } from '@/api/accountsync';
import { useAccountStatuses } from './account-status';

vi.mock('@/api/account', () => ({ getStatus: vi.fn() }));
vi.mock('@/api/accountsync', () => ({ statusChanged: vi.fn(), syncdone: vi.fn() }));

const syncing: TStatus = { disabled: false, fatalError: false, offlineError: null, synced: false };
const synced: TStatus = { ...syncing, synced: true };

describe('useAccountStatuses', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(statusChanged).mockImplementation(() => vi.fn());
    vi.mocked(syncdone).mockImplementation(() => vi.fn());
  });

  // Each account loads independently and refreshes on either status or sync completion events.
  it('loads statuses and follows account events', async () => {
    const codes = ['btc', 'ltc'];
    vi.mocked(getStatus).mockResolvedValue(syncing);
    const { result } = renderHook(() => useAccountStatuses(codes));
    expect(result.current.btc).toBeUndefined();
    await waitFor(() => expect(result.current).toEqual({ btc: syncing, ltc: syncing }));

    vi.mocked(getStatus).mockResolvedValue(synced);
    await act(async () => {
      vi.mocked(syncdone).mock.calls[0]![1]();
    });
    expect(result.current).toEqual({ btc: synced, ltc: syncing });

    await act(async () => {
      vi.mocked(statusChanged).mock.calls[1]![1](synced);
    });
    expect(result.current).toEqual({ btc: synced, ltc: synced });
  });

  // A slow initial status response must not overwrite a newer sync-completion response.
  it('ignores outdated responses for the same account', async () => {
    const codes = ['btc'];
    let resolveInitial!: (status: TStatus) => void;
    vi.mocked(getStatus)
      .mockImplementationOnce(() => new Promise(resolve => {
        resolveInitial = resolve;
      }))
      .mockResolvedValue(synced);
    const { result } = renderHook(() => useAccountStatuses(codes));

    await act(async () => {
      vi.mocked(syncdone).mock.calls[0]![1]();
    });
    expect(result.current.btc).toEqual(synced);
    await act(async () => {
      resolveInitial(syncing);
    });
    expect(result.current.btc).toEqual(synced);
  });

  // Changing the account set or unmounting removes listeners and discards pending old responses.
  it('cleans up when accounts change and on unmount', async () => {
    let resolveOld!: (status: TStatus) => void;
    vi.mocked(getStatus)
      .mockImplementationOnce(() => new Promise(resolve => {
        resolveOld = resolve;
      }))
      .mockResolvedValue(syncing);
    const { result, rerender, unmount } = renderHook(
      ({ codes }) => useAccountStatuses(codes),
      { initialProps: { codes: ['btc'] } },
    );
    const oldSyncCallback = vi.mocked(syncdone).mock.calls[0]![1];
    rerender({ codes: ['ltc'] });
    await waitFor(() => expect(result.current).toEqual({ ltc: syncing }));
    expect(vi.mocked(statusChanged).mock.results[0]!.value).toHaveBeenCalledOnce();
    expect(vi.mocked(syncdone).mock.results[0]!.value).toHaveBeenCalledOnce();

    await act(async () => {
      resolveOld(synced);
    });
    expect(result.current).toEqual({ ltc: syncing });
    const calls = vi.mocked(getStatus).mock.calls.length;
    oldSyncCallback();
    expect(getStatus).toHaveBeenCalledTimes(calls);

    unmount();
    expect(vi.mocked(statusChanged).mock.results[1]!.value).toHaveBeenCalledOnce();
    expect(vi.mocked(syncdone).mock.results[1]!.value).toHaveBeenCalledOnce();
    vi.mocked(syncdone).mock.calls[1]![1]();
    expect(getStatus).toHaveBeenCalledTimes(calls);
  });

  // A failed initial request leaves the account unavailable but can recover on a later event.
  it('recovers from a failed status request', async () => {
    const codes = ['btc'];
    const error = new Error('request failed');
    const logError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(getStatus).mockRejectedValueOnce(error).mockResolvedValue(synced);
    const { result } = renderHook(() => useAccountStatuses(codes));
    await waitFor(() => expect(logError).toHaveBeenCalledWith(error));
    expect(result.current.btc).toBeUndefined();
    await act(async () => {
      vi.mocked(syncdone).mock.calls[0]![1]();
    });
    expect(result.current.btc).toEqual(synced);
    logError.mockRestore();
  });
});
