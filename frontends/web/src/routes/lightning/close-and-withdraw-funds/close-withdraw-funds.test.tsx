// SPDX-License-Identifier: Apache-2.0

import '../../../../__mocks__/i18n';
import type { ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TAccount, TAmountWithConversions } from '@/api/account';
import * as lightningApi from '@/api/lightning';
import { BackButtonProvider } from '@/contexts/BackButtonContext';
import { LightningCloseWithdrawFunds } from './close-withdraw-funds';

vi.mock('@/i18n/i18n');

vi.mock('@/components/layout', () => ({
  Header: ({ title }: { title: ReactNode }) => <header>{title}</header>,
  Main: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));

vi.mock('@/components/amount/amount-with-unit', () => ({
  AmountWithUnit: ({ amount: displayedAmount }: { amount?: TAmountWithConversions }) => (
    <span>{displayedAmount?.amount}</span>
  ),
}));

vi.mock('@/components/groupedaccountselector/groupedaccountselector', () => ({
  GroupedAccountSelector: () => <div />,
}));

vi.mock('@/api/lightning', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/lightning')>();
  return {
    ...actual,
    getLightningBalance: vi.fn(),
    postCloseWithdraw: vi.fn(),
    postPrepareCloseWithdraw: vi.fn(),
  };
});

const amount = (value: string): TAmountWithConversions => ({
  amount: value,
  conversions: {},
  estimated: false,
  unit: 'sat',
});

const bitcoinAccount = {
  active: true,
  blockExplorerTxPrefix: '',
  code: 'btc-0',
  coinCode: 'btc',
} as TAccount;

const setMobileViewport = () => {
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
};

const SettingsPage = () => {
  const navigate = useNavigate();
  return <button onClick={() => navigate(-1)}>settings back</button>;
};

describe('Lightning Close & Withdraw back navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setMobileViewport();
    vi.mocked(lightningApi.getLightningBalance).mockResolvedValue({
      available: amount('10000'),
      fundingLimit: {
        limitSat: 20000,
        marginSat: 10000,
      },
      hasAvailable: true,
      hasIncoming: false,
      incoming: amount('0'),
    });
    vi.mocked(lightningApi.postPrepareCloseWithdraw).mockResolvedValue({
      balance: amount('10000'),
      balanceSat: 10000,
      fee: amount('100'),
      feeSat: 100,
    });
  });

  it('blocks Android back while closing', async () => {
    let resolveClose: (result: { txId: string; walletClosed: boolean }) => void = () => {};
    vi.mocked(lightningApi.postCloseWithdraw).mockReturnValue(new Promise(resolve => {
      resolveClose = resolve;
    }));

    render(
      <MemoryRouter initialEntries={['/lightning/close-withdraw-funds']}>
        <BackButtonProvider>
          <LightningCloseWithdrawFunds activeAccounts={[bitcoinAccount]} hasAccounts />
        </BackButtonProvider>
      </MemoryRouter>
    );

    const confirmation = await screen.findByLabelText('lightning.closeWithdrawFunds.confirm');
    fireEvent.click(confirmation);
    const closeButton = screen.getByRole('button', { name: 'lightning.settings.closeAndWithdrawFunds' });
    await waitFor(() => expect(closeButton).toBeEnabled());
    fireEvent.click(closeButton);
    await waitFor(() => expect(lightningApi.postCloseWithdraw).toHaveBeenCalledOnce());

    expect(document.querySelector('header button')).not.toBeInTheDocument();
    act(() => {
      expect(window.onBackButtonPressed?.()).toBe(false);
    });
    expect(confirmation).toBeDisabled();
    expect(closeButton).toBeDisabled();

    await act(async () => {
      resolveClose({ txId: 'close-txid', walletClosed: true });
    });
    expect(await screen.findByText('lightning.closeWithdrawFunds.success.message')).toBeInTheDocument();
  });

  it('pops the fallback route instead of adding Lightning Settings to history', async () => {
    render(
      <MemoryRouter
        initialEntries={[
          '/settings/advanced-settings',
          '/settings/lightning-settings',
          '/lightning/close-withdraw-funds',
        ]}
        initialIndex={2}
      >
        <BackButtonProvider>
          <Routes>
            <Route path="/settings/advanced-settings" element={<span>advanced settings</span>} />
            <Route path="/settings/lightning-settings" element={<SettingsPage />} />
            <Route
              path="/lightning/close-withdraw-funds"
              element={<LightningCloseWithdrawFunds activeAccounts={[]} hasAccounts={false} />}
            />
          </Routes>
        </BackButtonProvider>
      </MemoryRouter>
    );

    expect(await screen.findByText('lightning.topUp.noBitcoinAccounts')).toBeInTheDocument();
    act(() => {
      expect(window.onBackButtonPressed?.()).toBe(false);
    });
    fireEvent.click(await screen.findByRole('button', { name: 'settings back' }));

    expect(await screen.findByText('advanced settings')).toBeInTheDocument();
    expect(screen.queryByText('lightning.topUp.noBitcoinAccounts')).not.toBeInTheDocument();
  });

  it('keeps failure Cancel in the body and pops back to Lightning Settings', async () => {
    vi.mocked(lightningApi.postPrepareCloseWithdraw).mockRejectedValue(new Error('prepare failed'));

    render(
      <MemoryRouter
        initialEntries={[
          '/settings/advanced-settings',
          '/settings/lightning-settings',
          '/lightning/close-withdraw-funds',
        ]}
        initialIndex={2}
      >
        <BackButtonProvider>
          <Routes>
            <Route path="/settings/advanced-settings" element={<span>advanced settings</span>} />
            <Route path="/settings/lightning-settings" element={<SettingsPage />} />
            <Route
              path="/lightning/close-withdraw-funds"
              element={<LightningCloseWithdrawFunds activeAccounts={[bitcoinAccount]} hasAccounts />}
            />
          </Routes>
        </BackButtonProvider>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'dialog.cancel' }));
    fireEvent.click(await screen.findByRole('button', { name: 'settings back' }));

    expect(await screen.findByText('advanced settings')).toBeInTheDocument();
  });
});
