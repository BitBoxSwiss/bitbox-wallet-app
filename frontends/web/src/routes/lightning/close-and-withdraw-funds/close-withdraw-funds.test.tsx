// SPDX-License-Identifier: Apache-2.0

import '../../../../__mocks__/i18n';
import type { ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TAccount, TAmountWithConversions } from '@/api/account';
import * as keystoresApi from '@/api/keystores';
import * as lightningApi from '@/api/lightning';
import { TLightningErrorCode, TSdkError } from '@/api/lightning-errors';
import { open } from '@/api/system';
import { BackButtonProvider } from '@/contexts/BackButtonContext';
import { LightningCloseWithdrawFunds } from './close-withdraw-funds';

vi.mock('@/i18n/i18n');

vi.mock('@/api/system', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/api/system')>(),
  open: vi.fn(),
}));

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
  GroupedAccountSelector: ({ accounts, disabled, onChange, selected }: {
    accounts: TAccount[];
    disabled: boolean;
    onChange: (code: string) => void;
    selected: string;
  }) => (
    <select aria-label="destination" disabled={disabled} onChange={event => onChange(event.target.value)} value={selected}>
      {accounts.map(account => <option key={account.code} value={account.code}>{account.code}</option>)}
    </select>
  ),
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
  blockExplorerTxPrefix: 'https://example.com/tx/',
  code: 'btc-0',
  coinCode: 'btc',
} as TAccount;

const idempotencyKey = '00000000-0000-4000-8000-000000000001';

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

describe('Lightning Close & Withdraw', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.mocked(lightningApi.postCloseWithdraw).mockReset();
    vi.mocked(open).mockResolvedValue({ success: true });
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
      idempotencyKey,
      balance: amount('10000'),
      balanceSat: 10000,
      fee: amount('100'),
      feeSat: 100,
    });
  });

  it('prompts to connect a BitBox without leaving close and withdraw when there are no accounts', async () => {
    const connectAnyKeystore = vi.spyOn(keystoresApi, 'connectAnyKeystore').mockResolvedValue({
      success: false,
      errorCode: 'userAbort',
    });

    render(
      <MemoryRouter initialEntries={['/lightning/close-withdraw-funds']}>
        <BackButtonProvider>
          <Routes>
            <Route path="/" element={<span>portfolio</span>} />
            <Route
              path="/lightning/close-withdraw-funds"
              element={<LightningCloseWithdrawFunds activeAccounts={[]} hasAccounts={false} />}
            />
          </Routes>
        </BackButtonProvider>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: /connect/i }));

    await waitFor(() => expect(connectAnyKeystore).toHaveBeenCalledOnce());
    expect(screen.getByText('lightning.topUp.noBitcoinAccounts')).toBeInTheDocument();
    expect(screen.queryByText('portfolio')).not.toBeInTheDocument();
  });

  it('opens Manage accounts when accounts exist but no Bitcoin account is active', async () => {
    const connectAnyKeystore = vi.spyOn(keystoresApi, 'connectAnyKeystore');

    render(
      <MemoryRouter initialEntries={['/lightning/close-withdraw-funds']}>
        <BackButtonProvider>
          <Routes>
            <Route
              path="/lightning/close-withdraw-funds"
              element={<LightningCloseWithdrawFunds activeAccounts={[]} hasAccounts />}
            />
            <Route path="/settings/manage-accounts" element={<span>manage accounts page</span>} />
          </Routes>
        </BackButtonProvider>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: /manage/i }));

    expect(await screen.findByText('manage accounts page')).toBeInTheDocument();
    expect(connectAnyKeystore).not.toHaveBeenCalled();
  });

  it('blocks Android back while closing', async () => {
    let resolveClose: (result: lightningApi.TCloseWithdrawResult) => void = () => {};
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
    fireEvent.click(screen.getByText('lightning.closeWithdrawFunds.viewTransaction'));
    expect(open).toHaveBeenCalledWith('https://example.com/tx/close-txid');
  });

  it.each([
    { scenario: 'a lost response', error: new Error('response lost') },
    { scenario: 'an unclassified SDK error', error: new TSdkError('Bitcoin withdrawal failed') },
  ])('reuses the approved withdrawal after $scenario', async ({ error }) => {
    const close = vi.mocked(lightningApi.postCloseWithdraw);
    close.mockRejectedValueOnce(error);
    close.mockResolvedValue({ walletClosed: true, txId: 'close-txid' });
    render(
      <MemoryRouter>
        <BackButtonProvider>
          <LightningCloseWithdrawFunds activeAccounts={[bitcoinAccount]} hasAccounts />
        </BackButtonProvider>
      </MemoryRouter>
    );
    fireEvent.click(await screen.findByLabelText('lightning.closeWithdrawFunds.confirm'));
    const closeButton = screen.getByRole('button', { name: 'lightning.settings.closeAndWithdrawFunds' });
    await waitFor(() => expect(closeButton).toBeEnabled());
    fireEvent.click(closeButton);

    fireEvent.click(await screen.findByRole('button', { name: 'lightning.closeWithdrawFunds.failure.tryAgain' }));
    fireEvent.click(await screen.findByLabelText('lightning.closeWithdrawFunds.confirm'));
    fireEvent.click(screen.getByRole('button', { name: 'lightning.settings.closeAndWithdrawFunds' }));

    expect(await screen.findByText('lightning.closeWithdrawFunds.success.message')).toBeInTheDocument();
    expect(close).toHaveBeenCalledTimes(2);
    expect(close).toHaveBeenNthCalledWith(1, 'btc-0', 10000, 100, idempotencyKey);
    expect(close).toHaveBeenNthCalledWith(2, 'btc-0', 10000, 100, idempotencyKey);
    expect(lightningApi.postPrepareCloseWithdraw).toHaveBeenCalledOnce();
  });

  it('prepares a new withdrawal after a terminal payment failure', async () => {
    const newKey = '00000000-0000-4000-8000-000000000002';
    const close = vi.mocked(lightningApi.postCloseWithdraw);
    close
      .mockRejectedValueOnce(new TSdkError('Bitcoin withdrawal failed', TLightningErrorCode.WITHDRAWAL_FAILED))
      .mockResolvedValue({ walletClosed: true, txId: 'retry-txid' });
    render(
      <MemoryRouter>
        <BackButtonProvider>
          <LightningCloseWithdrawFunds activeAccounts={[bitcoinAccount]} hasAccounts />
        </BackButtonProvider>
      </MemoryRouter>
    );
    fireEvent.click(await screen.findByLabelText('lightning.closeWithdrawFunds.confirm'));
    const closeButton = screen.getByRole('button', { name: 'lightning.settings.closeAndWithdrawFunds' });
    await waitFor(() => expect(closeButton).toBeEnabled());
    fireEvent.click(closeButton);

    const retry = await screen.findByRole('button', { name: 'lightning.closeWithdrawFunds.failure.tryAgain' });
    vi.mocked(lightningApi.postPrepareCloseWithdraw).mockResolvedValue({
      idempotencyKey: newKey,
      balance: amount('10000'),
      balanceSat: 10000,
      fee: amount('200'),
      feeSat: 200,
    });
    fireEvent.click(retry);
    await waitFor(() => expect(lightningApi.postPrepareCloseWithdraw).toHaveBeenCalledTimes(2));
    expect(lightningApi.postPrepareCloseWithdraw).toHaveBeenLastCalledWith('btc-0', undefined);
    const confirmation = screen.getByLabelText('lightning.closeWithdrawFunds.confirm');
    expect(confirmation).not.toBeChecked();
    const retryCloseButton = screen.getByRole('button', { name: 'lightning.settings.closeAndWithdrawFunds' });
    expect(retryCloseButton).toBeDisabled();
    expect(close).toHaveBeenCalledOnce();

    fireEvent.click(confirmation);
    await waitFor(() => expect(retryCloseButton).toBeEnabled());
    fireEvent.click(retryCloseButton);
    expect(await screen.findByText('lightning.closeWithdrawFunds.success.message')).toBeInTheDocument();
    expect(close).toHaveBeenCalledTimes(2);
    expect(close).toHaveBeenNthCalledWith(1, 'btc-0', 10000, 100, idempotencyKey);
    expect(close).toHaveBeenNthCalledWith(2, 'btc-0', 10000, 200, newKey);
  });

  it('keeps the key when a changed fee requires a new approval', async () => {
    vi.mocked(lightningApi.postCloseWithdraw)
      .mockRejectedValueOnce(new TSdkError('fee changed', TLightningErrorCode.PAYMENT_APPROVAL_REQUIRED))
      .mockResolvedValue({ walletClosed: true, txId: 'close-txid' });
    render(
      <MemoryRouter>
        <BackButtonProvider>
          <LightningCloseWithdrawFunds activeAccounts={[bitcoinAccount]} hasAccounts />
        </BackButtonProvider>
      </MemoryRouter>
    );
    fireEvent.click(await screen.findByLabelText('lightning.closeWithdrawFunds.confirm'));
    const closeButton = screen.getByRole('button', { name: 'lightning.settings.closeAndWithdrawFunds' });
    await waitFor(() => expect(closeButton).toBeEnabled());
    fireEvent.click(closeButton);
    const retry = await screen.findByRole('button', { name: 'lightning.closeWithdrawFunds.failure.tryAgain' });
    vi.mocked(lightningApi.postPrepareCloseWithdraw).mockResolvedValue({
      idempotencyKey,
      balance: amount('10000'),
      balanceSat: 10000,
      fee: amount('200'),
      feeSat: 200,
    });
    fireEvent.click(retry);
    const retryCloseButton = await screen.findByRole('button', { name: 'lightning.settings.closeAndWithdrawFunds' });
    expect(retryCloseButton).toBeDisabled();
    fireEvent.click(screen.getByLabelText('lightning.closeWithdrawFunds.confirm'));
    await waitFor(() => expect(retryCloseButton).toBeEnabled());
    fireEvent.click(retryCloseButton);
    expect(await screen.findByText('lightning.closeWithdrawFunds.success.message')).toBeInTheDocument();
    expect(lightningApi.postPrepareCloseWithdraw).toHaveBeenLastCalledWith('btc-0', idempotencyKey);
    expect(lightningApi.postCloseWithdraw).toHaveBeenLastCalledWith('btc-0', 10000, 200, idempotencyKey);
  });

  it('uses a new key when the destination changes', async () => {
    const newKey = '00000000-0000-4000-8000-000000000002';
    vi.mocked(lightningApi.postCloseWithdraw).mockResolvedValue({ walletClosed: true, txId: 'close-txid' });
    render(
      <MemoryRouter>
        <BackButtonProvider>
          <LightningCloseWithdrawFunds activeAccounts={[bitcoinAccount, { ...bitcoinAccount, code: 'btc-1' }]} hasAccounts />
        </BackButtonProvider>
      </MemoryRouter>
    );
    fireEvent.click(await screen.findByLabelText('lightning.closeWithdrawFunds.confirm'));
    const closeButton = screen.getByRole('button', { name: 'lightning.settings.closeAndWithdrawFunds' });
    await waitFor(() => expect(closeButton).toBeEnabled());
    vi.mocked(lightningApi.postPrepareCloseWithdraw).mockResolvedValue({
      idempotencyKey: newKey,
      balance: amount('10000'),
      balanceSat: 10000,
      fee: amount('100'),
      feeSat: 100,
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'destination' }), { target: { value: 'btc-1' } });
    expect(closeButton).toBeDisabled();
    fireEvent.click(screen.getByLabelText('lightning.closeWithdrawFunds.confirm'));
    await waitFor(() => expect(closeButton).toBeEnabled());
    fireEvent.click(closeButton);
    expect(await screen.findByText('lightning.closeWithdrawFunds.success.message')).toBeInTheDocument();
    expect(lightningApi.postPrepareCloseWithdraw).toHaveBeenLastCalledWith('btc-1', undefined);
    expect(lightningApi.postCloseWithdraw).toHaveBeenCalledWith('btc-1', 10000, 100, newKey);
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
