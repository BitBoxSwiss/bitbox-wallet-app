// SPDX-License-Identifier: Apache-2.0

import '../../../../__mocks__/i18n';
import type { ReactNode } from 'react';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@/i18n/i18n';
import * as accountApi from '@/api/account';
import { statusChanged, syncdone } from '@/api/accountsync';
import * as coinsApi from '@/api/coins';
import * as swapApi from '@/api/swap';
import { alertUser } from '@/components/alert/Alert';
import { RatesContext } from '@/contexts/RatesContext';
import { MemoryRouter } from '@/utils/test-helpers';
import { Swap } from './swap';

vi.mock('@/i18n/i18n');
vi.mock('@/components/alert/Alert', () => ({ alertUser: vi.fn() }));
vi.mock('@/components/layout', () => ({
  GuideWrapper: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  GuidedContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Main: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Header: () => null,
}));
vi.mock('@/components/guide/guide', () => ({ Guide: () => null }));
vi.mock('@/components/backbutton/backbutton', () => ({ DesktopBackButton: () => null }));
vi.mock('./components/swap-confirm', () => ({ ConfirmSwap: () => null }));
vi.mock('./components/swap-result', () => ({ SwapResult: () => null }));
vi.mock('@/contexts/ConfigProvider', () => ({
  useConfig: () => ({ config: { frontend: { skipSwapkitDisclaimer: true } } }),
}));
vi.mock('@/contexts/app-state-context', () => {
  // Inactive token destinations are deliberately absent from the live account list.
  const state = { accounts: [] };
  return { useAppState: () => state };
});
vi.mock('@/api/account', async importOriginal => ({
  ...await importOriginal<typeof import('@/api/account')>(),
  getBalance: vi.fn(),
  getStatus: vi.fn(),
}));
vi.mock('@/api/accountsync', () => ({
  statusChanged: vi.fn(() => () => {}),
  syncdone: vi.fn(() => () => {}),
}));
vi.mock('@/api/coins', async importOriginal => ({
  ...await importOriginal<typeof import('@/api/coins')>(),
  convertToCurrency: vi.fn(),
  parseExternalBtcAmount: vi.fn(),
}));
vi.mock('@/api/swap', () => ({
  getSwapAccounts: vi.fn(), getSwapQuote: vi.fn(), signSwap: vi.fn(),
}));

const btc: swapApi.TSwapAccount = {
  active: true, code: 'btc', coinCode: 'btc', coinUnit: 'BTC', isToken: false,
  name: 'Bitcoin account',
  keystore: {
    connected: true, lastConnected: '', name: 'BitBox', rootFingerprint: '12345678', watchonly: false,
  },
};
const ltc: swapApi.TSwapAccount = {
  ...btc, active: false, code: 'ltc', coinCode: 'ltc', coinUnit: 'LTC', name: 'Litecoin account',
};
const eth: swapApi.TSwapAccount = {
  ...btc, code: 'eth', coinCode: 'eth', coinUnit: 'ETH', name: 'Ethereum account',
};
const token: swapApi.TSwapAccount = {
  ...btc, active: false, code: 'usdc', coinCode: 'eth-erc20-usdc', coinUnit: 'USDC',
  name: 'USDC account', isToken: true, parentAccountCode: 'eth',
};
const syncing: accountApi.TStatus = {
  disabled: false, fatalError: false, offlineError: null, synced: false,
};
const synced = { ...syncing, synced: true };
const syncingLabel = 'Syncing the account, please wait…';

const renderSwap = (source: swapApi.TSwapAccount, target: swapApi.TSwapAccount, others: swapApi.TSwapAccount[] = []) => {
  vi.mocked(swapApi.getSwapAccounts).mockResolvedValue({
    success: true, sellAccounts: [source], buyAccounts: [target, ...others],
    defaultSellAccountCode: source.code, defaultBuyAccountCode: target.code,
  });
  return render(
    <MemoryRouter>
      <RatesContext.Provider value={{
        activeCurrencies: [], btcUnit: 'default', defaultCurrency: 'USD',
        addToActiveCurrencies: vi.fn(), removeFromActiveCurrencies: vi.fn(), rotateBtcUnit: vi.fn(),
        rotateDefaultCurrency: vi.fn(), updateDefaultCurrency: vi.fn(),
      }}>
        <Swap />
      </RatesContext.Provider>
    </MemoryRouter>,
  );
};

describe('swap destination synchronization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((media: string) => ({
        matches: false, media, addEventListener: vi.fn(), removeEventListener: vi.fn(),
      })),
    });
    vi.mocked(accountApi.getBalance).mockResolvedValue({ success: false });
    vi.mocked(accountApi.getStatus).mockResolvedValue(syncing);
    vi.mocked(coinsApi.convertToCurrency).mockResolvedValue({ success: false });
    vi.mocked(coinsApi.parseExternalBtcAmount).mockResolvedValue({ success: true, amount: '1' });
    vi.mocked(swapApi.signSwap).mockImplementation(() => new Promise(() => {}));
    vi.mocked(swapApi.getSwapQuote).mockResolvedValue({
      success: true,
      quote: { routes: [{ expectedBuyAmount: '1', providers: ['thorchain'], routeId: 'route' }] },
    });
  });

  // Auto-selected inactive BTC/LTC destinations stay blocked until sync completes, then react to later status changes.
  it.each([{ ...btc, active: false }, ltc])('gates the $coinCode destination and shows its sync status', async target => {
    const user = userEvent.setup();
    let resolveStatus!: (status: accountApi.TStatus) => void;
    vi.mocked(accountApi.getStatus).mockImplementation(() => new Promise(resolve => {
      resolveStatus = resolve;
    }));
    renderSwap(eth, target);
    const sendInput = await screen.findByLabelText(/Send/);
    // The input stays disabled until its selected account is initialized.
    await waitFor(() => expect(sendInput).toBeEnabled());
    await user.type(sendInput, '1');
    expect(sendInput).toHaveValue(1);
    await screen.findByText('THORChain');
    expect(screen.getByRole('button', { name: syncingLabel })).toBeDisabled();

    await act(async () => {
      resolveStatus(syncing);
    });
    await user.click(screen.getAllByRole('combobox')[1]!);
    const option = await screen.findByRole('option', { name: new RegExp(target.name) });
    expect(option).toHaveAttribute('aria-disabled', 'true');
    expect(within(option).getByRole('status', { name: syncingLabel })).toBeInTheDocument();
    await user.keyboard('{Escape}');

    vi.mocked(accountApi.getStatus).mockResolvedValue(synced);
    await act(async () => {
      vi.mocked(syncdone).mock.calls.find(([code]) => code === target.code)![1]();
    });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Swap' })).toBeEnabled());
    expect(screen.queryByRole('status', { name: syncingLabel })).not.toBeInTheDocument();

    vi.mocked(accountApi.getStatus).mockResolvedValue(syncing);
    await act(async () => {
      vi.mocked(statusChanged).mock.calls[0]![1](syncing);
    });
    const swapButton = screen.getByRole('button', { name: syncingLabel });
    expect(swapButton).toBeDisabled();
    await user.click(swapButton);
    expect(swapApi.signSwap).not.toHaveBeenCalled();
  });

  // ETH and never-enabled token destinations need no sync status, even while another BTC-family destination is syncing.
  it.each([eth, token])('allows $coinCode without a live destination status', async target => {
    const user = userEvent.setup();
    renderSwap(btc, target, [ltc]);
    const sendInput = await screen.findByLabelText(/Send/);
    await waitFor(() => expect(sendInput).toBeEnabled());
    await user.type(sendInput, '1');
    await screen.findByText('THORChain');
    expect(accountApi.getStatus).not.toHaveBeenCalledWith(target.code);
    expect(statusChanged).not.toHaveBeenCalledWith(target.code, expect.any(Function));
    const swapButton = screen.getByRole('button', { name: 'Swap' });
    expect(swapButton).toBeEnabled();
    await user.click(swapButton);
    expect(swapApi.signSwap).toHaveBeenCalledWith({
      buyAccountCode: target.code, sellAccountCode: btc.code, sellAmount: '1', routeId: 'route',
    });
  });

  // The backend can still report a sync race; display the translated error instead of the internal code.
  it('translates a sync error returned during preparation', async () => {
    const user = userEvent.setup();
    vi.mocked(swapApi.signSwap).mockResolvedValue({
      success: false, errorCode: 'syncInProgress', errorMessage: 'syncInProgress',
    });
    renderSwap(btc, eth);
    const sendInput = await screen.findByLabelText(/Send/);
    await waitFor(() => expect(sendInput).toBeEnabled());
    await user.type(sendInput, '1');
    await screen.findByText('THORChain');
    await user.click(screen.getByRole('button', { name: 'Swap' }));
    expect(alertUser).toHaveBeenCalledWith('The account is still syncing. Please wait until syncing is complete and try again.');
  });
});
