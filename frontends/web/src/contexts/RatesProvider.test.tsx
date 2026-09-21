// SPDX-License-Identifier: Apache-2.0

import { act, ReactNode, useContext } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getConfig, setConfig, TConfig } from '@/api/config';
import { ConfigProvider, useConfig } from './ConfigProvider';
import { RatesContext } from './RatesContext';
import { RatesProvider } from './RatesProvider';

vi.mock('@/api/config', () => ({ getConfig: vi.fn(), setConfig: vi.fn() }));
vi.mock('@/api/rates', () => ({ reconfigureHistoryRates: vi.fn() }));

const deferred = <T, >() => {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>(nextResolve => {
    resolve = nextResolve;
  });
  return { promise, resolve };
};

const wrapper = ({ children }: { children: ReactNode }) => (
  <ConfigProvider><RatesProvider>{children}</RatesProvider></ConfigProvider>
);

const usePreferences = () => ({ config: useConfig(), rates: useContext(RatesContext) });

describe('Bitcoin unit preference', () => {
  let savedConfig: TConfig;

  beforeEach(() => {
    vi.resetAllMocks();
    savedConfig = {
      backend: { btcUnit: 'default', mainFiat: 'USD', fiatList: ['USD'] },
      frontend: {},
    } as TConfig;
    vi.mocked(getConfig).mockImplementation(async () => savedConfig);
    vi.mocked(setConfig).mockImplementation(async nextConfig => {
      savedConfig = nextConfig;
      return { success: true };
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it('loads the saved unit and publishes each toggle after one successful config write', async () => {
    savedConfig = { ...savedConfig, backend: { ...savedConfig.backend, btcUnit: 'sat' } };
    const save = deferred<void>();
    vi.mocked(setConfig).mockImplementationOnce(async nextConfig => {
      await save.promise;
      savedConfig = nextConfig;
      return { success: true };
    });
    const { result } = renderHook(usePreferences, { wrapper });
    await waitFor(() => expect(result.current.rates.btcUnit).toBe('sat'));

    let update: Promise<void>;
    act(() => {
      update = result.current.rates.rotateBtcUnit();
    });
    await waitFor(() => expect(setConfig).toHaveBeenCalledTimes(1));
    expect(result.current.rates.btcUnit).toBe('sat');

    await act(async () => {
      save.resolve();
      await update;
    });
    expect(savedConfig.backend.btcUnit).toBe('default');
    expect(result.current.rates.btcUnit).toBe('default');

    await act(async () => {
      await result.current.rates.rotateBtcUnit();
    });
    expect(setConfig).toHaveBeenCalledTimes(2);
    expect(savedConfig.backend.btcUnit).toBe('sat');
    expect(result.current.rates.btcUnit).toBe('sat');
  });

  it('keeps the saved unit on failure and permits a later retry', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(setConfig).mockResolvedValueOnce({ success: false, errorMessage: 'disk full' });
    const { result } = renderHook(usePreferences, { wrapper });
    await waitFor(() => expect(result.current.config.config).toBeDefined());

    await act(async () => {
      await result.current.rates.rotateBtcUnit();
    });
    expect(result.current.rates.btcUnit).toBe('default');
    expect(savedConfig.backend.btcUnit).toBe('default');
    expect(log).toHaveBeenCalledWith(new Error('disk full'));

    await act(async () => {
      await result.current.rates.rotateBtcUnit();
    });
    expect(result.current.rates.btcUnit).toBe('sat');
    expect(savedConfig.backend.btcUnit).toBe('sat');
  });

  it('preserves the selected unit when another config update overlaps', async () => {
    const save = deferred<void>();
    vi.mocked(setConfig).mockImplementationOnce(async nextConfig => {
      await save.promise;
      savedConfig = nextConfig;
      return { success: true };
    });
    const { result } = renderHook(usePreferences, { wrapper });
    await waitFor(() => expect(result.current.config.config).toBeDefined());
    let unitUpdate: Promise<void>;
    act(() => {
      unitUpdate = result.current.rates.rotateBtcUnit();
    });
    await waitFor(() => expect(setConfig).toHaveBeenCalledTimes(1));

    let otherUpdate: Promise<TConfig>;
    act(() => {
      otherUpdate = result.current.config.setConfig({ frontend: { hideAmounts: true } });
    });
    expect(setConfig).toHaveBeenCalledTimes(1);
    await act(async () => {
      save.resolve();
      await unitUpdate;
      await otherUpdate;
    });
    expect(setConfig).toHaveBeenCalledTimes(2);
    expect(savedConfig.backend.btcUnit).toBe('sat');
    expect(savedConfig.frontend.hideAmounts).toBe(true);
    expect(result.current.config.config).toEqual(savedConfig);
    expect(result.current.rates.btcUnit).toBe('sat');
  });

  it('ignores a late initial config response after a successful update', async () => {
    const initial = deferred<TConfig>();
    const oldConfig = savedConfig;
    vi.mocked(getConfig).mockReturnValueOnce(initial.promise);
    const { result } = renderHook(usePreferences, { wrapper });

    await act(async () => {
      await result.current.rates.rotateBtcUnit();
    });
    expect(setConfig).not.toHaveBeenCalled();
    await act(async () => {
      await result.current.config.setConfig({ backend: { btcUnit: 'sat' } });
    });
    expect(result.current.rates.btcUnit).toBe('sat');

    await act(async () => {
      initial.resolve(oldConfig);
      await initial.promise;
    });
    expect(result.current.rates.btcUnit).toBe('sat');
  });
});
