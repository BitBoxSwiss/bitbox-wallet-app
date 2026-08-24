// SPDX-License-Identifier: Apache-2.0

import '../../../__mocks__/i18n';
import type { ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as lightningApi from '@/api/lightning';
import { BackButtonProvider } from '@/contexts/BackButtonContext';
import { LightningSetLnurlAddress } from './set-lnurl-address';

vi.mock('@/i18n/i18n');

vi.mock('@/components/layout', () => ({
  Header: ({ title }: { title: ReactNode }) => <header>{title}</header>,
  Main: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));

vi.mock('@/hooks/debounce', () => ({
  useDebounce<T>(value: T) {
    return value;
  },
}));

vi.mock('@/api/lightning', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/lightning')>();
  return {
    ...actual,
    getLightningAddress: vi.fn(),
    getLightningAddressAvailability: vi.fn(),
    getLightningAddressDomain: vi.fn(),
    postRegisterLightningAddress: vi.fn(),
  };
});

const SettingsPage = () => {
  const navigate = useNavigate();
  return <button onClick={() => navigate(-1)}>settings back</button>;
};

describe('Set Lightning address back navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(window.matchMedia).mockImplementation(query => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    vi.mocked(lightningApi.getLightningAddress).mockResolvedValue('old@example.com');
    vi.mocked(lightningApi.getLightningAddressDomain).mockResolvedValue('example.com');
    vi.mocked(lightningApi.getLightningAddressAvailability).mockResolvedValue({
      address: 'new@example.com',
      available: true,
      username: 'new',
    });
  });

  it('blocks Android back while saving and returns without creating a history loop', async () => {
    let resolveSave: (address: string) => void = () => {};
    vi.mocked(lightningApi.postRegisterLightningAddress).mockReturnValue(new Promise(resolve => {
      resolveSave = resolve;
    }));

    render(
      <MemoryRouter
        initialEntries={[
          '/settings/advanced-settings',
          '/settings/lightning-settings',
          '/lightning/set-lnurl-address',
        ]}
        initialIndex={2}
      >
        <BackButtonProvider>
          <Routes>
            <Route path="/settings/advanced-settings" element={<span>advanced settings</span>} />
            <Route path="/settings/lightning-settings" element={<SettingsPage />} />
            <Route path="/lightning/set-lnurl-address" element={<LightningSetLnurlAddress />} />
          </Routes>
        </BackButtonProvider>
      </MemoryRouter>
    );

    const addressInput = await screen.findByLabelText('lightning.lnurlAddress.label');
    fireEvent.input(addressInput, { target: { value: 'new' } });
    expect(await screen.findByText('lightning.lnurlAddress.availability.available')).toBeInTheDocument();

    const saveButton = screen.getByRole('button', { name: 'button.save' });
    fireEvent.click(saveButton);
    await waitFor(() => expect(lightningApi.postRegisterLightningAddress).toHaveBeenCalledWith('new'));

    expect(document.querySelector('header button')).not.toBeInTheDocument();
    act(() => {
      expect(window.onBackButtonPressed?.()).toBe(false);
    });
    expect(saveButton).toBeDisabled();

    await act(async () => {
      resolveSave('new@example.com');
    });
    fireEvent.click(await screen.findByRole('button', { name: 'button.done' }));
    fireEvent.click(await screen.findByRole('button', { name: 'settings back' }));

    expect(await screen.findByText('advanced settings')).toBeInTheDocument();
    expect(screen.queryByText('lightning.lnurlAddress.description')).not.toBeInTheDocument();
  });
});
