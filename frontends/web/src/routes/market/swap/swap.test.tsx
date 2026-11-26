// SPDX-License-Identifier: Apache-2.0

import '../../../../__mocks__/i18n';
import type { TConfig } from '@/api/config';
import type { ContextType, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom';

vi.mock('@/i18n/i18n');
// initialize i18n once at startup
import '@/i18n/i18n';

vi.mock('@/components/alert/Alert', () => ({
  alertUser: vi.fn(),
}));
vi.mock('@/components/layout', () => ({
  GuideWrapper: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  GuidedContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Main: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Header: ({ title }: { title: ReactNode }) => <div>{title}</div>,
}));
vi.mock('@/components/view/view', () => ({
  View: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ViewButtons: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ViewContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/guide/guide', () => ({
  Guide: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/guide/entry', () => ({
  Entry: () => null,
}));
vi.mock('@/components/backbutton/backbutton', () => ({
  BackButton: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DesktopBackButton: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/spinner/SpinnerAnimation', () => ({
  SpinnerRingAnimated: () => null,
}));
vi.mock('./components/swap-confirm', () => ({
  ConfirmSwap: () => null,
}));
vi.mock('./components/swap-result', () => ({
  SwapResult: () => null,
}));
vi.mock('./components/input-with-account-selector', () => ({
  InputWithAccountSelector: ({
    id,
    onChangeValue,
    readOnlyAmount,
    value,
  }: {
    id: string;
    onChangeValue?: (value: string) => void;
    readOnlyAmount?: boolean;
    value?: string;
  }) => (
    readOnlyAmount ? <div data-testid={id}>{value}</div> : (
      <label htmlFor={id}>
        {id}
        <input
          id={id}
          aria-label={id}
          value={value || ''}
          onChange={event => onChangeValue?.(event.target.value)}
        />
      </label>
    )
  ),
}));
vi.mock('@/api/account', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/account')>();
  return {
    ...actual,
    getBalance: vi.fn(),
    getStatus: vi.fn(),
    proposeTx: vi.fn(),
    sendTx: vi.fn(),
  };
});
vi.mock('@/api/accountsync', () => ({
  statusChanged: vi.fn(() => () => {}),
  syncdone: vi.fn(() => () => {}),
}));
vi.mock('@/api/coins', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/coins')>();
  return {
    ...actual,
    convertToCurrency: vi.fn(),
    parseExternalBtcAmount: vi.fn(),
  };
});
vi.mock('@/api/swap', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/swap')>();
  return {
    ...actual,
    getSwapAccounts: vi.fn(),
    getSwapQuote: vi.fn(),
    getSwapStatus: vi.fn(),
    signSwap: vi.fn(),
  };
});
vi.mock('@/api/keystore', () => ({
  connectKeystore: vi.fn(),
  connectAnyKeystore: vi.fn(),
}));
vi.mock('@/contexts/ConfigProvider', () => ({
  useConfig: vi.fn(() => ({
    config: { frontend: { skipSwapkitDisclaimer: true }, backend: {} } as TConfig,
    setConfig: vi.fn(),
  })),
}));

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Switch } from 'wouter';
import { MemoryRouter } from '@/utils/test-helpers';
import * as accountApi from '@/api/account';
import * as coinsApi from '@/api/coins';
import * as swapApi from '@/api/swap';
import { connectKeystore } from '@/api/keystore';
import { alertUser } from '@/components/alert/Alert';
import { useConfig } from '@/contexts/ConfigProvider';
import { BackButtonProvider } from '@/contexts/BackButtonContext';
import { RatesContext } from '@/contexts/RatesContext';
import { Swap } from './swap';
import { AppStateContext } from '@/contexts/app-state-context';
import { AppContext } from '@/contexts/AppContext';

const mockUseConfig = vi.mocked(useConfig);

const sellAccount: accountApi.TAccount = {
  keystore: {
    connected: true,
    lastConnected: '',
    name: 'BitBox02',
    rootFingerprint: 'f23ab988',
    watchonly: false,
  },
  active: true,
  blockExplorerTxPrefix: '',
  code: 'btc-account',
  coinCode: 'btc',
  coinName: 'Bitcoin',
  coinUnit: 'BTC',
  isToken: false,
  name: 'Bitcoin Account',
};

const buyAccount: accountApi.TAccount = {
  keystore: {
    connected: true,
    lastConnected: '',
    name: 'BitBox02',
    rootFingerprint: 'f23ab988',
    watchonly: false,
  },
  active: true,
  blockExplorerTxPrefix: '',
  code: 'eth-account',
  coinCode: 'eth',
  coinName: 'Ethereum',
  coinUnit: 'ETH',
  isToken: false,
  name: 'Ethereum Account',
};

const swapSellAccount: swapApi.TSwapAccount = {
  active: true,
  code: 'btc-account',
  coinCode: 'btc',
  coinUnit: 'BTC',
  isToken: false,
  keystore: sellAccount.keystore,
  name: 'Bitcoin Account',
};

const swapBuyAccount: swapApi.TSwapAccount = {
  active: true,
  code: 'eth-account',
  coinCode: 'eth',
  coinUnit: 'ETH',
  isToken: false,
  keystore: buyAccount.keystore,
  name: 'Ethereum Account',
};

const swapBuyTokenAccount: swapApi.TSwapAccount = {
  active: true,
  code: 'usdc-account',
  coinCode: 'eth-erc20-usdc',
  coinUnit: 'USDC',
  isToken: true,
  keystore: buyAccount.keystore,
  name: 'USDC Account',
  parentAccountCode: 'eth-account',
};

const setFirmwareUpdateDialogOpen = vi.fn<ContextType<typeof AppContext>['setFirmwareUpdateDialogOpen']>();
const firmwareSwap = (appState: Partial<ContextType<typeof AppStateContext>> = {}) => (
  <AppContext.Consumer>{appContext => (
    <AppContext.Provider value={{ ...appContext, setFirmwareUpdateDialogOpen }}>
      <BackButtonProvider>
        <RatesContext.Provider value={{
          activeCurrencies: [],
          addToActiveCurrencies: vi.fn(),
          btcUnit: 'default',
          defaultCurrency: 'USD',
          removeFromActiveCurrencies: vi.fn(),
          rotateBtcUnit: vi.fn(),
          rotateDefaultCurrency: vi.fn(),
          updateDefaultCurrency: vi.fn(),
        }}>
          <AppStateContext.Provider value={{
            accounts: [sellAccount, buyAccount],
            activeAccounts: [sellAccount, buyAccount],
            deviceIDs: ['test-device'],
            devices: { 'test-device': 'bitbox02' },
            hasAccounts: true,
            hasBottomNavigation: false,
            hasDevices: true,
            lightningAccount: undefined,
            hasLightningAccount: false,
            isBitboxBootloader: false,
            ...appState,
          }}>
            <MemoryRouter initialEntries={['/market/swap']}>
              <Switch>
                <Route path="/market/swap"><Swap /></Route>
                <Route path="/settings/device-settings/test-device">firmware settings</Route>
              </Switch>
            </MemoryRouter>
          </AppStateContext.Provider>
        </RatesContext.Provider>
      </BackButtonProvider>
    </AppContext.Provider>
  )}</AppContext.Consumer>
);

const renderFirmwareSwap = () => render(firmwareSwap());

describe('routes/market/swap', () => {
  beforeEach(() => {
    // Unused one-shot responses must not carry over to another test.
    vi.resetAllMocks();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    vi.mocked(accountApi.getBalance).mockResolvedValue({ success: false });
    vi.mocked(accountApi.getStatus).mockResolvedValue({
      disabled: false, fatalError: false, offlineError: null, synced: true,
    });
    vi.mocked(coinsApi.parseExternalBtcAmount).mockResolvedValue({ success: false, amount: '' });
    vi.mocked(connectKeystore).mockResolvedValue({ success: true });
    vi.mocked(swapApi.getSwapStatus).mockResolvedValue({
      available: true, connectedKeystore: 'multi', firmwareUpgradeRequired: false,
    });
    vi.mocked(swapApi.getSwapAccounts).mockResolvedValue({
      success: true,
      sellAccounts: [swapSellAccount],
      buyAccounts: [swapBuyAccount],
      defaultSellAccountCode: swapSellAccount.code,
      defaultBuyAccountCode: swapBuyAccount.code,
    });
    vi.mocked(swapApi.getSwapQuote).mockResolvedValue({
      success: true,
      quote: {
        routes: [{
          expectedBuyAmount: '1.23',
          providers: ['thorchain', 'mayachain'],
          routeId: 'route-1',
        }],
      },
    });
    mockUseConfig.mockReturnValue({
      config: { frontend: { skipSwapkitDisclaimer: true }, backend: {} } as TConfig,
      setConfig: vi.fn(),
    });
  });

  // Older firmware keeps quotes visible but blocks swapping and links directly to the firmware update flow.
  it.each([false, true])('shows an inline warning only when firmwareUpgradeRequired is %s', async firmwareUpgradeRequired => {
    const user = userEvent.setup();
    vi.mocked(swapApi.getSwapStatus).mockResolvedValue({
      available: true, connectedKeystore: 'multi', firmwareUpgradeRequired,
    });
    renderFirmwareSwap();

    await user.type(await screen.findByLabelText('swapSendAmount'), '1');
    expect(await screen.findByText('THORChain + Mayachain')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    if (firmwareUpgradeRequired) {
      expect(screen.getByText('Update your BitBox to the latest firmware to swap.')).toBeVisible();
      expect(screen.getByRole('button', { name: 'Swap' })).toBeDisabled();
      await user.click(screen.getByRole('button', { name: 'Swap' }));
      expect(swapApi.signSwap).not.toHaveBeenCalled();
      expect(accountApi.proposeTx).not.toHaveBeenCalled();
      expect(accountApi.sendTx).not.toHaveBeenCalled();

      await user.click(screen.getByRole('link', { name: 'Update firmware' }));
      expect(setFirmwareUpdateDialogOpen).toHaveBeenCalledExactlyOnceWith(true);
      expect(await screen.findByText('firmware settings')).toBeInTheDocument();
    } else {
      expect(screen.queryByText('Update your BitBox to the latest firmware to swap.')).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Update firmware' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Swap' })).toBeEnabled();
    }
  });

  // A quote alone must not enable swapping before the connected device's firmware has been checked.
  it('disables swapping while the firmware requirement is loading', async () => {
    const user = userEvent.setup();
    let resolveStatus!: (status: swapApi.TSwapStatusResponse) => void;
    vi.mocked(swapApi.getSwapStatus).mockReturnValue(new Promise(resolve => {
      resolveStatus = resolve;
    }));
    renderFirmwareSwap();
    await user.type(await screen.findByLabelText('swapSendAmount'), '1');
    expect(await screen.findByText('THORChain + Mayachain')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Swap' })).toBeDisabled();

    await act(async () => resolveStatus({ available: true, connectedKeystore: 'multi', firmwareUpgradeRequired: false }));

    expect(screen.getByRole('button', { name: 'Swap' })).toBeEnabled();
  });

  // A rejected status check is visible and retryable; swapping stays blocked until the retry succeeds.
  it('shows a status error and retries without losing the quote', async () => {
    const user = userEvent.setup();
    let resolveStatus!: (status: swapApi.TSwapStatusResponse) => void;
    vi.mocked(swapApi.getSwapStatus)
      .mockRejectedValueOnce(new Error('Status unavailable'))
      .mockImplementationOnce(() => new Promise(resolve => {
        resolveStatus = resolve;
      }));
    renderFirmwareSwap();

    const statusError = 'Unable to check swap availability. Please try again.';
    expect(await screen.findByText(statusError)).toBeVisible();
    await user.type(await screen.findByLabelText('swapSendAmount'), '1');
    expect(await screen.findByText('THORChain + Mayachain')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Swap' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(swapApi.getSwapStatus).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(statusError)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Swap' })).toBeDisabled();
    await act(async () => resolveStatus({ available: true, connectedKeystore: 'multi', firmwareUpgradeRequired: false }));

    expect(screen.getByRole('button', { name: 'Swap' })).toBeEnabled();
    expect(screen.getByText('THORChain + Mayachain')).toBeVisible();
    expect(swapApi.getSwapQuote).toHaveBeenCalledTimes(1);
    expect(alertUser).not.toHaveBeenCalled();
  });

  // Account/device changes retry failed checks, and an older rejection must not overwrite a newer success.
  it.each(['accounts', 'devices'] as const)('reloads status when %s change and ignores stale errors', async changed => {
    const user = userEvent.setup();
    let rejectStatus!: (reason: Error) => void;
    vi.mocked(swapApi.getSwapStatus)
      .mockRejectedValueOnce(new Error('Status unavailable'))
      .mockImplementationOnce(() => new Promise((_resolve, reject) => {
        rejectStatus = reject;
      }));
    const appState = {
      accounts: [sellAccount, buyAccount],
      devices: { 'test-device': 'bitbox02' },
    } satisfies Partial<ContextType<typeof AppStateContext>>;
    const { rerender } = render(firmwareSwap(appState));
    const statusError = 'Unable to check swap availability. Please try again.';
    expect(await screen.findByText(statusError)).toBeVisible();
    await user.type(await screen.findByLabelText('swapSendAmount'), '1');
    await screen.findByText('THORChain + Mayachain');

    const updateAppState = () => ({
      ...appState,
      ...(changed === 'accounts' ? { accounts: [...appState.accounts] } : { devices: { ...appState.devices } }),
    });
    rerender(firmwareSwap(updateAppState()));

    expect(swapApi.getSwapStatus).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(statusError)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Swap' })).toBeDisabled();
    rerender(firmwareSwap(updateAppState()));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Swap' })).toBeEnabled());
    expect(swapApi.getSwapStatus).toHaveBeenCalledTimes(3);

    await act(async () => rejectStatus(new Error('Stale status failure')));

    expect(screen.queryByText(statusError)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Swap' })).toBeEnabled();
  });

  // Connection rejection or cancellation releases both submission guards so the user can try again.
  it.each(['rejected', 'cancelled'] as const)('allows another attempt after a %s connection', async outcome => {
    const user = userEvent.setup();
    if (outcome === 'rejected') {
      vi.mocked(connectKeystore).mockRejectedValueOnce(new Error('Connection failed'));
    } else {
      vi.mocked(connectKeystore).mockResolvedValueOnce({ success: false, errorCode: 'userAbort' });
    }
    vi.mocked(swapApi.signSwap).mockResolvedValue({ success: false, errorMessage: 'Preparation stopped' });
    renderFirmwareSwap();
    await user.type(await screen.findByLabelText('swapSendAmount'), '1');
    await screen.findByText('THORChain + Mayachain');

    await user.click(screen.getByRole('button', { name: 'Swap' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Swap' })).toBeEnabled());
    expect(swapApi.signSwap).not.toHaveBeenCalled();
    expect(accountApi.proposeTx).not.toHaveBeenCalled();
    expect(accountApi.sendTx).not.toHaveBeenCalled();
    if (outcome === 'rejected') {
      expect(alertUser).toHaveBeenCalledExactlyOnceWith('Connection failed');
    } else {
      expect(alertUser).not.toHaveBeenCalled();
    }

    await user.click(screen.getByRole('button', { name: 'Swap' }));

    expect(connectKeystore).toHaveBeenCalledTimes(2);
    expect(swapApi.signSwap).toHaveBeenCalledTimes(1);
  });

  // Rechecking the selected keystore before preparation catches firmware changes after loading the form.
  it('shows the inline warning if the signing-time firmware check fails', async () => {
    const user = userEvent.setup();
    vi.mocked(connectKeystore).mockResolvedValue({ success: false, errorCode: 'firmwareUpgradeRequired' });
    renderFirmwareSwap();
    await user.type(await screen.findByLabelText('swapSendAmount'), '1');
    expect(await screen.findByText('THORChain + Mayachain')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Swap' }));

    expect(connectKeystore).toHaveBeenCalledExactlyOnceWith(sellAccount.keystore.rootFingerprint, 'swapPaymentRequests');
    expect(await screen.findByText('Update your BitBox to the latest firmware to swap.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Swap' })).toBeDisabled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(swapApi.signSwap).not.toHaveBeenCalled();
    expect(accountApi.proposeTx).not.toHaveBeenCalled();
    expect(accountApi.sendTx).not.toHaveBeenCalled();
  });

  // Quote requests identify the sell account, and the returned providers appear together.
  it('renders grouped provider label after quote fetch', async () => {
    const user = userEvent.setup();

    render(
      <BackButtonProvider>
        <RatesContext.Provider
          value={{
            activeCurrencies: [],
            addToActiveCurrencies: vi.fn(),
            btcUnit: 'default',
            defaultCurrency: 'USD',
            removeFromActiveCurrencies: vi.fn(),
            rotateBtcUnit: vi.fn(),
            rotateDefaultCurrency: vi.fn(),
            updateDefaultCurrency: vi.fn(),
          }}>
          <AppStateContext.Provider
            value={{
              accounts: [sellAccount, buyAccount],
              activeAccounts: [sellAccount, buyAccount],
              deviceIDs: [],
              devices: {},
              hasAccounts: false,
              hasBottomNavigation: false,
              hasDevices: false,
              lightningAccount: undefined,
              hasLightningAccount: false,
              isBitboxBootloader: false,
            }}
          >
            <MemoryRouter>
              <Swap />
            </MemoryRouter>
          </AppStateContext.Provider>
        </RatesContext.Provider>
      </BackButtonProvider>
    );

    await user.type(await screen.findByLabelText('swapSendAmount'), '1');

    expect(await screen.findByText('THORChain + Mayachain')).toBeInTheDocument();
    await waitFor(() => {
      expect(swapApi.getSwapQuote).toHaveBeenCalledWith({
        buyCoinCode: 'eth',
        sellAccountCode: 'btc-account',
        sellAmount: '1',
      });
    });
  });

  it('shows no-route quote errors with display units', async () => {
    const user = userEvent.setup();

    vi.mocked(swapApi.getSwapAccounts).mockResolvedValue({
      success: true,
      sellAccounts: [swapBuyAccount],
      buyAccounts: [swapBuyTokenAccount],
      defaultSellAccountCode: swapBuyAccount.code,
      defaultBuyAccountCode: swapBuyTokenAccount.code,
    });
    vi.mocked(swapApi.getSwapQuote).mockResolvedValue({
      success: false,
      quoteErrorCode: 'noRoutesFound',
      errorData: {
        buyCoin: 'USDC',
        sellCoin: 'ETH',
      },
      errorMessage: 'No routes found for ETH.ETH to ETH.USDC-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    });

    render(
      <BackButtonProvider>
        <RatesContext.Provider
          value={{
            activeCurrencies: [],
            addToActiveCurrencies: vi.fn(),
            btcUnit: 'default',
            defaultCurrency: 'USD',
            removeFromActiveCurrencies: vi.fn(),
            rotateBtcUnit: vi.fn(),
            rotateDefaultCurrency: vi.fn(),
            updateDefaultCurrency: vi.fn(),
          }}>
          <AppStateContext.Provider
            value={{
              accounts: [buyAccount],
              activeAccounts: [buyAccount],
              deviceIDs: [],
              devices: {},
              hasAccounts: false,
              hasBottomNavigation: false,
              hasDevices: false,
              lightningAccount: undefined,
              hasLightningAccount: false,
              isBitboxBootloader: false,
            }}
          >
            <MemoryRouter>
              <Swap />
            </MemoryRouter>
          </AppStateContext.Provider>
        </RatesContext.Provider>
      </BackButtonProvider>
    );

    await user.type(await screen.findByLabelText('swapSendAmount'), '1');

    expect(await screen.findByText('No route found from ETH to USDC. Try entering a larger amount. Otherwise try again later.')).toBeInTheDocument();
    expect(screen.queryByText(/ETH\.ETH/)).not.toBeInTheDocument();
    expect(screen.queryByText(/ETH\.USDC/)).not.toBeInTheDocument();
  });

  it('shows insufficient funds warning together with no-route errors', async () => {
    const user = userEvent.setup();

    vi.mocked(swapApi.getSwapQuote).mockResolvedValue({
      success: false,
      quoteErrorCode: 'noRoutesFound',
      errorData: {
        buyCoin: 'ETH',
        sellCoin: 'BTC',
      },
      errorMessage: 'No routes found',
      validationErrorCode: 'insufficientFunds',
    });

    render(
      <BackButtonProvider>
        <RatesContext.Provider
          value={{
            activeCurrencies: [],
            addToActiveCurrencies: vi.fn(),
            btcUnit: 'default',
            defaultCurrency: 'USD',
            removeFromActiveCurrencies: vi.fn(),
            rotateBtcUnit: vi.fn(),
            rotateDefaultCurrency: vi.fn(),
            updateDefaultCurrency: vi.fn(),
          }}>
          <AppStateContext.Provider
            value={{
              accounts: [sellAccount, buyAccount],
              activeAccounts: [sellAccount, buyAccount],
              deviceIDs: [],
              devices: {},
              hasAccounts: false,
              hasBottomNavigation: false,
              hasDevices: false,
              lightningAccount: undefined,
              hasLightningAccount: false,
              isBitboxBootloader: false,
            }}
          >
            <MemoryRouter>
              <Swap />
            </MemoryRouter>
          </AppStateContext.Provider>
        </RatesContext.Provider>
      </BackButtonProvider>
    );

    await user.type(await screen.findByLabelText('swapSendAmount'), '2');

    expect(await screen.findByText('No route found from BTC to ETH. Try entering a larger amount. Otherwise try again later.')).toBeInTheDocument();
    expect(screen.getByText(/insufficient funds/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Swap' })).toBeDisabled();
  });

  // Quote failures and amount validation render independently and both clear when a valid quote arrives.
  it.each([undefined, 'insufficientFunds'] as const)(
    'shows provider offline error with validation %s and clears it after a successful quote',
    async (validationErrorCode) => {
      const user = userEvent.setup();
      vi.mocked(swapApi.getSwapQuote).mockResolvedValueOnce({
        success: false,
        quoteErrorCode: 'providersUnavailable',
        errorMessage: 'Providers unavailable',
        validationErrorCode,
      });

      render(
        <BackButtonProvider>
          <RatesContext.Provider
            value={{
              activeCurrencies: [],
              addToActiveCurrencies: vi.fn(),
              btcUnit: 'default',
              defaultCurrency: 'USD',
              removeFromActiveCurrencies: vi.fn(),
              rotateBtcUnit: vi.fn(),
              rotateDefaultCurrency: vi.fn(),
              updateDefaultCurrency: vi.fn(),
            }}>
            <AppStateContext.Provider
              value={{
                accounts: [sellAccount, buyAccount],
                activeAccounts: [sellAccount, buyAccount],
                deviceIDs: [],
                devices: {},
                hasAccounts: false,
                hasBottomNavigation: false,
                hasDevices: false,
                lightningAccount: undefined,
                hasLightningAccount: false,
                isBitboxBootloader: false,
              }}
            >
              <MemoryRouter>
                <Swap />
              </MemoryRouter>
            </AppStateContext.Provider>
          </RatesContext.Provider>
        </BackButtonProvider>
      );

      const sellAmountInput = await screen.findByLabelText('swapSendAmount');
      await user.type(sellAmountInput, '1');

      const offlineMessage = 'Swap providers are currently unavailable for the selected sell asset. Please try again later.';
      expect(await screen.findByText(offlineMessage)).toBeInTheDocument();
      expect(screen.queryByText(/Try entering a larger amount/)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Swap' })).toBeDisabled();
      if (validationErrorCode) {
        expect(screen.getByText(/insufficient funds/i)).toBeInTheDocument();
      }

      await user.clear(sellAmountInput);
      await user.type(sellAmountInput, '2');

      expect(await screen.findByText('THORChain + Mayachain')).toBeInTheDocument();
      expect(screen.queryByText(offlineMessage)).not.toBeInTheDocument();
      expect(screen.queryByText(/insufficient funds/i)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Swap' })).toBeEnabled();
    },
  );

  // A successful quote can have insufficient funds; keep the preview, block swapping, and clear validation on recovery.
  it('keeps quote output visible for insufficient funds and clears validation after recovery', async () => {
    const user = userEvent.setup();

    vi.mocked(swapApi.getSwapQuote).mockResolvedValueOnce({
      success: true,
      validationErrorCode: 'insufficientFunds',
      quote: {
        routes: [{
          expectedBuyAmount: '1.23',
          providers: ['thorchain', 'mayachain'],
          routeId: 'route-1',
        }],
      },
    });

    render(
      <BackButtonProvider>
        <RatesContext.Provider
          value={{
            activeCurrencies: [],
            addToActiveCurrencies: vi.fn(),
            btcUnit: 'default',
            defaultCurrency: 'USD',
            removeFromActiveCurrencies: vi.fn(),
            rotateBtcUnit: vi.fn(),
            rotateDefaultCurrency: vi.fn(),
            updateDefaultCurrency: vi.fn(),
          }}>
          <AppStateContext.Provider
            value={{
              accounts: [sellAccount, buyAccount],
              activeAccounts: [sellAccount, buyAccount],
              deviceIDs: [],
              devices: {},
              hasAccounts: false,
              hasBottomNavigation: false,
              hasDevices: false,
              lightningAccount: undefined,
              hasLightningAccount: false,
              isBitboxBootloader: false,
            }}
          >
            <MemoryRouter>
              <Swap />
            </MemoryRouter>
          </AppStateContext.Provider>
        </RatesContext.Provider>
      </BackButtonProvider>
    );

    const sellAmountInput = await screen.findByLabelText('swapSendAmount');
    await user.type(sellAmountInput, '2');

    expect(await screen.findByText('THORChain + Mayachain')).toBeInTheDocument();
    expect(await screen.findByTestId('swapGetAmount')).toHaveTextContent('1.23');
    expect(screen.getByText(/insufficient funds/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Swap' })).toBeDisabled();

    await user.clear(sellAmountInput);
    await user.type(sellAmountInput, '1');

    expect(await screen.findByText('THORChain + Mayachain')).toBeInTheDocument();
    expect(screen.queryByText(/insufficient funds/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Swap' })).toBeEnabled();
  });

  // Gas warnings follow the selected route, and the Buy link opens the token's parent account.
  it('offers buying ETH for the token parent when the selected route needs more gas', async () => {
    const user = userEvent.setup();
    const parentAccount = { ...buyAccount, code: 'eth-account-2', name: 'Ethereum 2' };
    const tokenAccount = { ...swapBuyTokenAccount, parentAccountCode: parentAccount.code };
    vi.mocked(swapApi.getSwapAccounts).mockResolvedValue({
      success: true,
      sellAccounts: [tokenAccount],
      buyAccounts: [swapSellAccount],
    });
    vi.mocked(swapApi.getSwapQuote).mockResolvedValue({
      success: true,
      quote: {
        routes: [{
          expectedBuyAmount: '0.001',
          insufficientGasFunds: true,
          providers: ['thorchain'],
          routeId: 'expensive',
        }, {
          expectedBuyAmount: '0.0009',
          insufficientGasFunds: false,
          providers: ['chainflip'],
          routeId: 'affordable',
        }],
      },
    });

    render(
      <BackButtonProvider>
        <RatesContext.Provider
          value={{
            activeCurrencies: [],
            addToActiveCurrencies: vi.fn(),
            btcUnit: 'default',
            defaultCurrency: 'USD',
            removeFromActiveCurrencies: vi.fn(),
            rotateBtcUnit: vi.fn(),
            rotateDefaultCurrency: vi.fn(),
            updateDefaultCurrency: vi.fn(),
          }}>
          <AppStateContext.Provider
            value={{
              accounts: [sellAccount, buyAccount, parentAccount],
              activeAccounts: [sellAccount, buyAccount, parentAccount],
              deviceIDs: [],
              devices: {},
              hasAccounts: false,
              hasBottomNavigation: false,
              hasDevices: false,
              lightningAccount: undefined,
              hasLightningAccount: false,
              isBitboxBootloader: false,
            }}
          >
            <MemoryRouter initialEntries={['/market/swap']}>
              <Switch>
                <Route path="/market/swap" component={Swap} />
                <Route path="/market/select/eth-account-2" component={() => <div>Buy Ethereum 2</div>} />
              </Switch>
            </MemoryRouter>
          </AppStateContext.Provider>
        </RatesContext.Provider>
      </BackButtonProvider>
    );

    const amountInput = await screen.findByLabelText('swapSendAmount');
    await user.type(amountInput, '2');

    expect(await screen.findByRole('link', { name: 'Buy ETH now' })).toHaveAttribute('href', '/market/select/eth-account-2?tab=buy');
    expect(screen.getByText('Ethereum 2', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByTestId('swapGetAmount')).toHaveTextContent('0.001');
    const swapButton = screen.getByRole('button', { name: 'Swap' });
    expect(swapButton).toBeDisabled();
    await user.click(swapButton);
    expect(swapApi.signSwap).not.toHaveBeenCalled();

    await user.click(screen.getByText('THORChain'));
    await user.click(await screen.findByText('Chainflip'));
    expect(screen.queryByRole('link', { name: 'Buy ETH now' })).not.toBeInTheDocument();
    expect(swapButton).toBeEnabled();

    await user.click(screen.getByText('Chainflip'));
    await user.click(await screen.findByText('THORChain'));
    expect(swapButton).toBeDisabled();
    expect(screen.getByRole('link', { name: 'Buy ETH now' })).toBeInTheDocument();

    await user.clear(amountInput);
    expect(screen.queryByRole('link', { name: 'Buy ETH now' })).not.toBeInTheDocument();
    expect(swapButton).toBeDisabled();
    await user.type(amountInput, '2');
    await user.click(await screen.findByRole('link', { name: 'Buy ETH now' }));
    expect(await screen.findByText('Buy Ethereum 2')).toBeInTheDocument();
    expect(window.location.hash).toBe('#/market/select/eth-account-2?tab=buy');
  });

  it('disables swap button immediately when sell amount changes', async () => {
    const user = userEvent.setup();

    vi.mocked(swapApi.getSwapQuote)
      .mockResolvedValueOnce({
        success: true,
        quote: {
          routes: [{
            expectedBuyAmount: '1.23',
            providers: ['thorchain', 'mayachain'],
            routeId: 'route-1',
          }],
        },
      })
      .mockImplementationOnce(() => new Promise(() => {}));

    render(
      <BackButtonProvider>
        <RatesContext.Provider
          value={{
            activeCurrencies: [],
            addToActiveCurrencies: vi.fn(),
            btcUnit: 'default',
            defaultCurrency: 'USD',
            removeFromActiveCurrencies: vi.fn(),
            rotateBtcUnit: vi.fn(),
            rotateDefaultCurrency: vi.fn(),
            updateDefaultCurrency: vi.fn(),
          }}>
          <AppStateContext.Provider
            value={{
              accounts: [sellAccount, buyAccount],
              activeAccounts: [sellAccount, buyAccount],
              deviceIDs: [],
              devices: {},
              hasAccounts: false,
              hasBottomNavigation: false,
              hasDevices: false,
              lightningAccount: undefined,
              hasLightningAccount: false,
              isBitboxBootloader: false,
            }}
          >
            <MemoryRouter>
              <Swap />
            </MemoryRouter>
          </AppStateContext.Provider>
        </RatesContext.Provider>
      </BackButtonProvider>
    );

    const sellAmountInput = await screen.findByLabelText('swapSendAmount');
    const swapButton = screen.getByRole('button', { name: 'Swap' });

    await user.type(sellAmountInput, '1');

    await waitFor(() => expect(swapButton).toBeEnabled());
    expect(screen.getByText('THORChain + Mayachain')).toBeInTheDocument();

    await user.type(sellAmountInput, '2');

    expect(swapButton).toBeDisabled();
    expect(screen.queryByText('THORChain + Mayachain')).not.toBeInTheDocument();
  });
});
