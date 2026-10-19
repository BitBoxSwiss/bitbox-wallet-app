// SPDX-License-Identifier: Apache-2.0

import '../../../../__mocks__/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, Route, Switch } from 'wouter';
import { MemoryRouter } from '@/utils/test-helpers';
import * as accountApi from '@/api/account';
import { AppStateContext } from '@/contexts/app-state-context';
import { BackButtonProvider } from '@/contexts/BackButtonContext';
import { BackNavigationProvider } from '@/contexts/BackNavigationContext';
import { WCWeb3WalletContext } from '@/contexts/WCWeb3WalletContext';
import { ConnectScreenWalletConnect } from './connect';
import { DashboardWalletConnect } from './dashboard';

vi.mock('@/api/account');
vi.mock('./guide', () => ({ WCGuide: () => null }));

describe('WalletConnect address loading failures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(accountApi.getReceiveAddressList).mockReturnValue(async () => ({
      success: false,
      errorMessage: 'addresses unavailable',
    }));
  });

  // Both error screens must retain their title, page layout, and a working way back to the account.
  it.each([
    { name: 'connection', path: '/account/account/wallet-connect/connect', Component: ConnectScreenWalletConnect },
    { name: 'dashboard', path: '/account/account/wallet-connect/dashboard', Component: DashboardWalletConnect },
  ])('keeps back navigation on the $name screen', async ({ path, Component }) => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/account/account']}>
        <BackNavigationProvider>
          <BackButtonProvider>
            <AppStateContext.Provider value={{
              accounts: [], activeAccounts: [], deviceIDs: [], devices: {},
              hasAccounts: false, hasBottomNavigation: false, hasDevices: false,
              hasLightningAccount: false, lightningAccount: null,
            }}>
              <WCWeb3WalletContext.Provider value={{
                isWalletInitialized: false,
                initializeWeb3Wallet: vi.fn(),
                pair: vi.fn(),
              }}>
                <Switch>
                  <Route path="/account/account">
                    <Link to={path}>Open WalletConnect</Link>
                  </Route>
                  <Route path="/account/:code/wallet-connect/:view" component={Component} />
                </Switch>
              </WCWeb3WalletContext.Provider>
            </AppStateContext.Provider>
          </BackButtonProvider>
        </BackNavigationProvider>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('link', { name: 'Open WalletConnect' }));
    const main = await screen.findByRole('main');
    expect(within(main).getByText('addresses unavailable')).toBeVisible();
    expect(within(main).getAllByRole('heading', { name: 'walletConnect.walletConnect' })).not.toHaveLength(0);

    await user.click(within(main).getByText('button.back'));
    expect(await screen.findByRole('link', { name: 'Open WalletConnect' })).toBeVisible();
  });
});
