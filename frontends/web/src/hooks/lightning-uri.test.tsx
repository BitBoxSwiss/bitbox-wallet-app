// SPDX-License-Identifier: Apache-2.0

import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getLightningURI, subscribeLightningURI, type TLightningURI } from '@/api/lightning';
import { isLightningFeatureAvailable } from '@/utils/env';
import { useLightningURI } from './lightning-uri';

vi.mock('@/api/lightning', () => ({
  getLightningURI: vi.fn(),
  subscribeLightningURI: vi.fn(),
}));
vi.mock('@/utils/env', () => ({ isLightningFeatureAvailable: vi.fn() }));

const wrapper = ({ children }: { children: ReactNode }) => (
  <MemoryRouter initialEntries={['/account-summary']}>{children}</MemoryRouter>
);

const useTestURI = () => ({
  request: useLightningURI(),
  location: useLocation(),
  navigate: useNavigate(),
});

describe('useLightningURI', () => {
  let onURI: (request: TLightningURI) => void;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(isLightningFeatureAvailable).mockReturnValue(true);
    vi.mocked(getLightningURI).mockResolvedValue({ revision: 0, input: null });
    vi.mocked(subscribeLightningURI).mockImplementation(callback => {
      onURI = callback;
      return vi.fn();
    });
  });

  it.each(['invoice', ''])('opens retained input %j for validation', async input => {
    vi.mocked(getLightningURI).mockResolvedValue({ revision: 1, input });
    const { result } = renderHook(useTestURI, { wrapper });
    await waitFor(() => expect(result.current.location.pathname).toBe('/lightning/send'));
    expect(result.current.request?.input).toBe(input);
  });

  it('keeps a new link when the initial load resolves with older state', async () => {
    let resolveLoad: (request: TLightningURI) => void = () => {};
    vi.mocked(getLightningURI).mockReturnValue(new Promise(resolve => {
      resolveLoad = resolve;
    }));
    const { result } = renderHook(useTestURI, { wrapper });
    act(() => onURI({ revision: 2, input: 'new' }));
    await act(async () => resolveLoad({ revision: 1, input: 'old' }));
    expect(result.current.request?.input).toBe('new');
    expect(result.current.location.pathname).toBe('/lightning/send');
  });

  it('does not navigate again for a handled link, but opens a later click', async () => {
    const { result } = renderHook(useTestURI, { wrapper });
    await waitFor(() => expect(result.current.request).toBeDefined());
    act(() => onURI({ revision: 1, input: 'invoice' }));
    const sendLocationKey = result.current.location.key;
    act(() => onURI({ revision: 2, input: 'next' }));
    expect(result.current.location.key).toBe(sendLocationKey);
    act(() => result.current.navigate('/lightning'));
    expect(result.current.location.pathname).toBe('/lightning');
    act(() => onURI({ revision: 3, input: null }));
    expect(result.current.location.pathname).toBe('/lightning');
    act(() => onURI({ revision: 4, input: 'next' }));
    expect(result.current.location.pathname).toBe('/lightning/send');
  });

  it('does not load or subscribe where Lightning is unavailable', () => {
    vi.mocked(isLightningFeatureAvailable).mockReturnValue(false);
    const { result } = renderHook(useTestURI, { wrapper });
    expect(getLightningURI).not.toHaveBeenCalled();
    expect(subscribeLightningURI).not.toHaveBeenCalled();
    expect(result.current.location.pathname).toBe('/account-summary');
  });

  it('retains the newest link without interrupting activation', async () => {
    const { result } = renderHook(useTestURI, { wrapper });
    await waitFor(() => expect(result.current.request).toBeDefined());
    act(() => onURI({ revision: 1, input: 'invoice' }));
    act(() => result.current.navigate('/lightning/activate'));
    act(() => onURI({ revision: 2, input: 'newer-invoice' }));

    expect(result.current.location.pathname).toBe('/lightning/activate');
    expect(result.current.request?.input).toBe('newer-invoice');

    act(() => result.current.navigate('/lightning/send', { replace: true }));
    expect(result.current.request?.input).toBe('newer-invoice');
    act(() => onURI({ revision: 3, input: null }));
    act(() => result.current.navigate('/lightning'));
    expect(result.current.location.pathname).toBe('/lightning');
  });
});
