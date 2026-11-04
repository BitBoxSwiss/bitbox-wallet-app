// SPDX-License-Identifier: Apache-2.0

import i18n from '../../../../__mocks__/i18n';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Route, Switch } from 'wouter';
import type { TAccount } from '@/api/account';
import * as accountApi from '@/api/account';
import { syncdone } from '@/api/accountsync';
import * as keystoresApi from '@/api/keystores';
import { AppStateContext } from '@/contexts/app-state-context';
import { BackButtonProvider } from '@/contexts/BackButtonContext';
import { BackNavigationProvider } from '@/contexts/BackNavigationContext';
import { MemoryRouter } from '@/utils/test-helpers';
import { useLocation, useNavigationType } from '@/utils/router-compatability';
import { SendWrapper } from '@/routes/account/send/send-wrapper';
import en from '@/locales/en/app.json';
import { LightningTopUp } from './topup';

vi.mock('@/i18n/i18n');
vi.mock('@/api/accountsync', () => ({ syncdone: vi.fn(() => vi.fn()) }));
vi.mock('@/routes/account/send/send', () => ({
  Send: ({ account, fixedRecipient, onBack, onDone }: {
    account: TAccount;
    fixedRecipient?: 'lightning';
    onBack?: () => void;
    onDone?: () => void;
  }) => (
    <>
      <span>{account.name}: {fixedRecipient}</span>
      <button onClick={onBack}>Send back</button>
      <button onClick={onDone}>Send done</button>
    </>
  ),
}));

const account: TAccount = {
  keystore: {
    watchonly: false,
    rootFingerprint: 'f23ab988',
    name: 'BitBox02',
    lastConnected: '',
    connected: true,
  },
  active: true,
  coinCode: 'btc',
  coinUnit: 'BTC',
  coinName: 'Bitcoin',
  code: 'btc-account',
  name: 'Bitcoin Account',
  isToken: false,
  blockExplorerTxPrefix: '',
};
const otherAccount = { ...account, code: 'other-btc', name: 'Other Bitcoin' };
const balanceResult = (hasAvailable: boolean): Awaited<ReturnType<typeof accountApi.getBalance>> => ({
  success: true,
  balance: {
    hasAvailable,
    hasIncoming: false,
    available: { amount: hasAvailable ? '0.001' : '0', unit: 'BTC', conversions: {}, estimated: false },
    incoming: { amount: '0', unit: 'BTC', conversions: {}, estimated: false },
  },
});

const CurrentPath = () => {
  const { pathname, search } = useLocation();
  const navigationType = useNavigationType();
  return <span data-testid="current-path">{pathname}{search} {navigationType}</span>;
};

const renderTopUp = (activeAccounts = [account], hasAccounts = true) => render(
  <MemoryRouter initialEntries={['/lightning', '/lightning/topup']}>
    <BackButtonProvider>
      <BackNavigationProvider>
        <AppStateContext.Provider value={{
          accounts: activeAccounts,
          activeAccounts,
          deviceIDs: [],
          devices: {},
          hasAccounts,
          hasBottomNavigation: false,
          hasDevices: false,
          lightningAccount: undefined,
          hasLightningAccount: false,
        }}>
          <Switch>
            <Route path="/lightning/topup" component={LightningTopUp} />
            <Route path="/account/:code/send" component={SendWrapper} />
          </Switch>
          <CurrentPath />
        </AppStateContext.Provider>
      </BackNavigationProvider>
    </BackButtonProvider>
  </MemoryRouter>
);

const selectAccount = async (name: string) => {
  fireEvent.mouseDown(await screen.findByRole('combobox'));
  await waitFor(() => expect(screen.getByRole('option', { name: new RegExp(name) })).toHaveAttribute('aria-disabled', 'false'));
  fireEvent.click(screen.getByRole('option', { name: new RegExp(name) }));
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
};

describe('LightningTopUp', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(syncdone).mockClear();
    i18n.addResourceBundle('en', 'translation', en);
    vi.spyOn(accountApi, 'getBalance').mockResolvedValue(balanceResult(true));
  });

  // No accounts must keep the connect prompt on Top up when connection is cancelled.
  it('prompts to connect a BitBox when there are no accounts', async () => {
    const connect = vi.spyOn(keystoresApi, 'connectAnyKeystore').mockResolvedValue({ success: false, errorCode: 'userAbort' });
    renderTopUp([], false);
    fireEvent.click(await screen.findByRole('button', { name: /connect/i }));
    await waitFor(() => expect(connect).toHaveBeenCalledOnce());
    expect(screen.getByTestId('current-path')).toHaveTextContent('/lightning/topup');
  });

  // Accounts of other networks or coins must not be offered as a top-up source.
  it('opens Manage accounts when no active mainnet Bitcoin account exists', () => {
    renderTopUp([
      { ...account, active: false },
      { ...account, code: 'tbtc', coinCode: 'tbtc' },
      { ...account, code: 'eth', coinCode: 'eth' },
    ]);
    fireEvent.click(screen.getByRole('button', { name: /manage/i }));
    expect(screen.getByTestId('current-path')).toHaveTextContent('/settings/manage-accounts');
  });

  // Replacing the skipped picker prevents Back from redirecting into Send again.
  it('skips a single account and returns directly to Lightning', async () => {
    renderTopUp();
    expect(await screen.findByText('Bitcoin Account: lightning')).toBeVisible();
    expect(screen.getByTestId('current-path')).toHaveTextContent('/account/btc-account/send?recipient=lightning REPLACE');
    fireEvent.click(screen.getByRole('button', { name: 'Send back' }));
    expect(screen.getByTestId('current-path')).toHaveTextContent('/lightning REPLACE');
  });

  // Selection stays explicit and includes funded disconnected accounts.
  it('selects a source, returns to the picker, and can choose another source', async () => {
    renderTopUp([account, { ...otherAccount, keystore: { ...account.keystore, connected: false } }]);
    expect(await screen.findByRole('button', { name: 'Next' })).toBeDisabled();
    await selectAccount('Other Bitcoin');
    expect(await screen.findByText('Other Bitcoin: lightning')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Send back' }));
    await selectAccount('Bitcoin Account');
    expect(await screen.findByText('Bitcoin Account: lightning')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Send done' }));
    expect(screen.getByTestId('current-path')).toHaveTextContent('/lightning PUSH');
  });

  // The single-account shortcut must wait for a funded balance and react when an empty account receives coins.
  it('keeps a single empty account blocked until funds become available', async () => {
    let resolve!: (result: Awaited<ReturnType<typeof accountApi.getBalance>>) => void;
    vi.mocked(accountApi.getBalance).mockReturnValueOnce(new Promise(done => {
      resolve = done;
    }));
    renderTopUp();
    expect(await screen.findByRole('button', { name: 'Next' })).toBeDisabled();
    expect(screen.getByTestId('current-path')).toHaveTextContent('/lightning/topup');
    await act(async () => resolve(balanceResult(false)));
    fireEvent.mouseDown(screen.getByRole('combobox'));
    expect(screen.getByRole('option', { name: /Bitcoin Account/ })).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(screen.getByRole('option', { name: /Bitcoin Account/ }));
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    expect(accountApi.getBalance).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.mocked(syncdone).mock.calls.find(([code]) => code === account.code)?.[1]();
    });
    expect(await screen.findByText('Bitcoin Account: lightning')).toBeVisible();
    expect(accountApi.getBalance).toHaveBeenCalledTimes(2);
  });

  // Empty and unavailable balances stay disabled without blocking funded accounts or hiding the empty row.
  it.each(['response', 'rejection'])('disables empty accounts and failed balance %s while keeping funded accounts selectable', async failure => {
    const unavailable = { ...account, code: 'unavailable', name: 'Unavailable account' };
    vi.mocked(accountApi.getBalance).mockImplementation(async code => {
      if (code === unavailable.code) {
        if (failure === 'rejection') {
          throw new Error('Balance unavailable');
        }
        return { success: false };
      }
      return balanceResult(code === account.code);
    });
    renderTopUp([account, otherAccount, unavailable]);
    fireEvent.mouseDown(await screen.findByRole('combobox'));
    await waitFor(() => expect(screen.getByRole('option', { name: /Bitcoin Account/ })).toHaveAttribute('aria-disabled', 'false'));
    expect(screen.getByRole('option', { name: /Other Bitcoin/ })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('option', { name: /Unavailable account/ })).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(screen.getByRole('option', { name: /Other Bitcoin/ }));
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    fireEvent.click(screen.getByRole('option', { name: /Bitcoin Account/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Bitcoin Account: lightning')).toBeVisible();
  });

  // Refreshing a selected account to empty must also disable Next, not just the dropdown row.
  it('blocks proceeding when the selected account loses its available balance', async () => {
    renderTopUp([account, otherAccount]);
    fireEvent.mouseDown(await screen.findByRole('combobox'));
    await waitFor(() => expect(screen.getByRole('option', { name: /Bitcoin Account/ })).toHaveAttribute('aria-disabled', 'false'));
    fireEvent.click(screen.getByRole('option', { name: /Bitcoin Account/ }));
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
    vi.mocked(accountApi.getBalance).mockResolvedValue(balanceResult(false));
    await act(async () => {
      vi.mocked(syncdone).mock.calls.find(([code]) => code === account.code)?.[1]();
    });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByTestId('current-path')).toHaveTextContent('/lightning/topup');
  });
});
