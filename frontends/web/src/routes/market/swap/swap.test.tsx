// SPDX-License-Identifier: Apache-2.0

import '../../../../__mocks__/i18n';
import type { TConfig } from '@/api/config';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom';

vi.mock('@/i18n/i18n');
// initialize i18n once at startup
import '@/i18n/i18n';

vi.mock('@/components/alert/Alert', () => ({
  alertUser: vi.fn(),
}));
vi.mock('@/components/dialog/firmware-upgrade-required-dialog', () => ({
  FirmwareUpgradeRequiredDialog: () => null,
}));
vi.mock('@/components/layout', () => ({
  GuideWrapper: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  GuidedContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Main: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Header: ({ title }: { title: ReactNode }) => <div>{title}</div>,
  Column: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Grid: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/view/view', () => ({
  View: ({ children, fullscreen }: { children: ReactNode; fullscreen?: boolean }) => (
    <div data-testid={fullscreen ? 'fullscreen-view' : undefined}>{children}</div>
  ),
  ViewButtons: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ViewContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ViewHeader: ({ title }: { title?: ReactNode }) => <h1>{title}</h1>,
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
    proposeTx: vi.fn(),
    sendTx: vi.fn(),
  };
});
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
    signSwap: vi.fn(),
  };
});
vi.mock('@/contexts/ConfigProvider', () => ({
  useConfig: vi.fn(() => ({
    config: { frontend: {}, backend: {} } as TConfig,
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
import { useConfig } from '@/contexts/ConfigProvider';
import { BackButtonProvider } from '@/contexts/BackButtonContext';
import { RatesContext } from '@/contexts/RatesContext';
import { Swap } from './swap';
import { AppStateContext } from '@/contexts/app-state-context';
import { LocalizationContext } from '@/contexts/localization-context';
import { alertUser } from '@/components/alert/Alert';

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

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(resolvePromise => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

const preparedSwap = (amount: string, unit = 'ETH'): Extract<swapApi.TSwapSignResponse, { success: true }> => ({
  success: true,
  expectedBuyAmount: amount,
  swapId: 'swap-1',
  txInput: {
    address: 'deposit-address', amount: '1', sendAll: 'no', selectedUTXOs: [], useHighestFee: true,
    paymentRequest: {
      recipientName: 'SwapKit', nonce: null, signature: 'signed-payload',
      outputs: [{ address: 'deposit-address', amount: '100000000' }],
      memos: [{
        type: 'coinPurchase',
        coinPurchase: { coinType: unit === 'BTC' ? 0 : 60, amount: `${amount} ${unit}`, address: 'receive-address' },
      }],
    },
  },
});

const renderSwapFlow = (btcUnit: 'default' | 'sat' = 'default') => render(
  <BackButtonProvider>
    <LocalizationContext.Provider value={{ decimal: '.', group: '\'' }}>
      <RatesContext.Provider value={{
        activeCurrencies: ['USD'], btcUnit, defaultCurrency: 'USD',
        addToActiveCurrencies: vi.fn(), removeFromActiveCurrencies: vi.fn(),
        rotateBtcUnit: vi.fn(), rotateDefaultCurrency: vi.fn(), updateDefaultCurrency: vi.fn(),
      }}>
        <AppStateContext.Provider value={{
          accounts: [sellAccount, buyAccount], activeAccounts: [sellAccount, buyAccount],
          deviceIDs: [], devices: {}, hasAccounts: true, hasBottomNavigation: false,
          hasDevices: true, lightningAccount: undefined, hasLightningAccount: false,
        }}>
          <MemoryRouter><Swap /></MemoryRouter>
        </AppStateContext.Provider>
      </RatesContext.Provider>
    </LocalizationContext.Provider>
  </BackButtonProvider>,
);

const requestReview = async () => {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText('swapSendAmount'), '1');
  const button = screen.getByRole('button', { name: 'Swap' });
  await waitFor(() => expect(button).toBeEnabled());
  await user.click(button);
  return user;
};

describe('routes/market/swap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    vi.mocked(coinsApi.parseExternalBtcAmount).mockResolvedValue({ success: false, amount: '' });
    vi.mocked(swapApi.getSwapAccounts).mockResolvedValue({
      success: true,
      sellAccounts: [swapSellAccount],
      buyAccounts: [swapBuyAccount],
      defaultSellAccountCode: swapSellAccount.code,
      defaultBuyAccountCode: swapBuyAccount.code,
    });
    vi.mocked(swapApi.getSwapQuote).mockReset().mockResolvedValue({
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
      config: { frontend: {}, backend: {} } as TConfig,
      setConfig: vi.fn(),
    });
  });

  // The swap entry explains repricing; quotes identify the sell account and show grouped providers.
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
            }}
          >
            <MemoryRouter>
              <Swap />
            </MemoryRouter>
          </AppStateContext.Provider>
        </RatesContext.Provider>
      </BackButtonProvider>
    );

    const agreeButton = await screen.findByTestId('agree-swap-terms');
    expect(screen.getByText(/Receive amounts shown before review are estimates/)).toBeInTheDocument();
    await user.click(agreeButton);

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
            }}
          >
            <MemoryRouter>
              <Swap />
            </MemoryRouter>
          </AppStateContext.Provider>
        </RatesContext.Provider>
      </BackButtonProvider>
    );

    await user.click(await screen.findByTestId('agree-swap-terms'));
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
            }}
          >
            <MemoryRouter>
              <Swap />
            </MemoryRouter>
          </AppStateContext.Provider>
        </RatesContext.Provider>
      </BackButtonProvider>
    );

    await user.click(await screen.findByTestId('agree-swap-terms'));
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
              }}
            >
              <MemoryRouter>
                <Swap />
              </MemoryRouter>
            </AppStateContext.Provider>
          </RatesContext.Provider>
        </BackButtonProvider>
      );

      await user.click(await screen.findByTestId('agree-swap-terms'));
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
            }}
          >
            <MemoryRouter>
              <Swap />
            </MemoryRouter>
          </AppStateContext.Provider>
        </RatesContext.Provider>
      </BackButtonProvider>
    );

    await user.click(await screen.findByTestId('agree-swap-terms'));
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

    await user.click(await screen.findByTestId('agree-swap-terms'));
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
            }}
          >
            <MemoryRouter>
              <Swap />
            </MemoryRouter>
          </AppStateContext.Provider>
        </RatesContext.Provider>
      </BackButtonProvider>
    );

    await user.click(await screen.findByTestId('agree-swap-terms'));

    const sellAmountInput = await screen.findByLabelText('swapSendAmount');
    const swapButton = screen.getByRole('button', { name: 'Swap' });

    await user.type(sellAmountInput, '1');

    await waitFor(() => expect(swapButton).toBeEnabled());
    expect(screen.getByText('THORChain + Mayachain')).toBeInTheDocument();

    await user.type(sellAmountInput, '2');

    expect(swapButton).toBeDisabled();
    expect(screen.queryByText('THORChain + Mayachain')).not.toBeInTheDocument();
  });
  describe('prepared review', () => {
    beforeEach(() => {
      mockUseConfig.mockReturnValue({
        config: { frontend: { skipSwapkitDisclaimer: true }, backend: {} } as TConfig,
        setConfig: vi.fn(),
      });
      vi.mocked(swapApi.signSwap).mockReset().mockResolvedValue(preparedSwap('1.24'));
      const amount: accountApi.TAmountWithConversions = {
        amount: '1', unit: 'BTC', conversions: { USD: '100.00' }, estimated: false,
      };
      vi.mocked(accountApi.proposeTx).mockReset().mockResolvedValue({
        success: true, recipientDisplayAddress: 'SwapKit', amount, total: amount,
        fee: { ...amount, amount: '0.00001', conversions: { USD: '0.01' } },
      });
      vi.mocked(accountApi.sendTx).mockReset().mockImplementation(() => new Promise(() => {}));
      vi.mocked(coinsApi.convertToCurrency).mockReset().mockResolvedValue({ success: true, fiatAmount: '42.00' });
    });

    // Both providers can reprice in either direction; review and fiat must use preparation, not preview.
    it.each([
      ['FLASHNET', '1.240000000000000001'], ['FLASHNET', '1.22'], ['FLASHNET', '1.23'],
      ['NEAR', '1.240000000000000001'], ['NEAR', '1.22'], ['NEAR', '1.23'],
    ])('reviews the prepared %s amount %s', async (provider, amount) => {
      vi.mocked(swapApi.getSwapQuote).mockResolvedValue({
        success: true,
        quote: { routes: [{ routeId: 'route-1', providers: [provider], expectedBuyAmount: '1.23' }] },
      });
      const prepared = preparedSwap(amount);
      vi.mocked(swapApi.signSwap).mockResolvedValue(prepared);
      renderSwapFlow();
      await requestReview();

      const review = await screen.findByTestId('fullscreen-view');
      expect(review).toHaveTextContent(`${amount} ETH`);
      expect(review).toHaveTextContent('42.00 USD');
      expect(review).toHaveTextContent('0.00001 BTC');
      expect(coinsApi.convertToCurrency).toHaveBeenCalledWith({ amount, coinCode: 'eth', fiatUnit: 'USD' });
      expect(accountApi.proposeTx).toHaveBeenCalledWith('btc-account', prepared.txInput);
      expect(accountApi.sendTx).toHaveBeenCalledTimes(1);
    });

    // A signed BTC amount keeps the current BTC/sat preference and supplies fiat in that same display unit.
    it.each([['default', '0.00293089'], ['sat', '293089']] as const)(
      'preserves %s display for a prepared BTC receive amount', async (btcUnit, displayAmount) => {
        vi.mocked(swapApi.getSwapAccounts).mockResolvedValue({
          success: true, sellAccounts: [swapBuyAccount], buyAccounts: [swapSellAccount],
        });
        vi.mocked(swapApi.getSwapQuote).mockResolvedValue({
          success: true,
          quote: { routes: [{ routeId: 'route-1', providers: ['FLASHNET'], expectedBuyAmount: '0.00292978' }] },
        });
        vi.mocked(swapApi.signSwap).mockResolvedValue(preparedSwap('0.00293089', 'BTC'));
        vi.mocked(coinsApi.parseExternalBtcAmount).mockImplementation(async amount => ({
          success: true, amount: amount === '0.00292978' ? '292978' : '293089',
        }));
        renderSwapFlow(btcUnit);
        await requestReview();

        expect(await screen.findByTestId('fullscreen-view')).toHaveTextContent(
          `${displayAmount} ${btcUnit === 'sat' ? 'sat' : 'BTC'}`,
        );
        expect(coinsApi.convertToCurrency).toHaveBeenCalledWith({
          amount: displayAmount, coinCode: 'btc', fiatUnit: 'USD',
        });
      },
    );

    // Token review must retain the prepared amount's full precision, including values above Number's safe range.
    it('preserves ERC20 receive precision', async () => {
      const amount = '9007199254740993.123456';
      vi.mocked(swapApi.getSwapAccounts).mockResolvedValue({
        success: true, sellAccounts: [swapSellAccount], buyAccounts: [swapBuyTokenAccount],
      });
      vi.mocked(swapApi.signSwap).mockResolvedValue(preparedSwap(amount, 'USDC'));
      renderSwapFlow();
      await requestReview();
      expect(await screen.findByTestId('fullscreen-view')).toHaveTextContent(`${amount} USDC`);
    });

    // Unavailable fiat must not replace the prepared crypto amount or stop device confirmation.
    it('keeps the receive amount when fiat conversion is unavailable', async () => {
      vi.mocked(coinsApi.convertToCurrency).mockResolvedValue({ success: false });
      renderSwapFlow();
      await requestReview();
      const review = await screen.findByTestId('fullscreen-view');
      expect(review).toHaveTextContent('1.24 ETH');
      expect(review).toHaveTextContent('--- USD');
      expect(accountApi.sendTx).toHaveBeenCalledTimes(1);
    });

    // A failed BTC-to-sat conversion must never show the BTC number labelled as sats or start signing.
    it('stops confirmation when receive-unit conversion fails', async () => {
      vi.mocked(swapApi.getSwapAccounts).mockResolvedValue({
        success: true, sellAccounts: [swapBuyAccount], buyAccounts: [swapSellAccount],
      });
      vi.mocked(swapApi.signSwap).mockResolvedValue(preparedSwap('0.00293089', 'BTC'));
      renderSwapFlow('sat');
      await requestReview();
      await waitFor(() => expect(alertUser).toHaveBeenCalled());
      expect(screen.queryByTestId('fullscreen-view')).not.toBeInTheDocument();
      expect(accountApi.sendTx).not.toHaveBeenCalled();
    });

    // Device cancellation clears review; retry must prepare and display the new amount exactly once.
    it('prepares a fresh amount after cancellation', async () => {
      const send = deferred<accountApi.TSendTx>();
      vi.mocked(accountApi.sendTx).mockReturnValueOnce(send.promise);
      renderSwapFlow();
      const user = await requestReview();
      expect(await screen.findByTestId('fullscreen-view')).toHaveTextContent('1.24 ETH');
      await act(async () => {
        send.resolve({ success: false, aborted: true });
      });
      await user.click(await screen.findByRole('button', { name: 'Edit transaction' }));
      vi.mocked(swapApi.signSwap).mockResolvedValue(preparedSwap('1.25'));
      await user.dblClick(screen.getByRole('button', { name: 'Swap' }));
      const review = await screen.findByTestId('fullscreen-view');
      expect(review).toHaveTextContent('1.25 ETH');
      expect(review).not.toHaveTextContent('1.24 ETH');
      expect(swapApi.signSwap).toHaveBeenCalledTimes(2);
      expect(accountApi.sendTx).toHaveBeenCalledTimes(2);
    });

    // A quote arriving after preparation must not overwrite the review already shown with the device.
    it('retains prepared details when a later preview quote arrives', async () => {
      const quote = deferred<swapApi.TSwapQuoteResponse>();
      const preparation = deferred<swapApi.TSwapSignResponse>();
      vi.mocked(swapApi.signSwap).mockReturnValueOnce(preparation.promise);
      renderSwapFlow();
      const user = await requestReview();
      vi.mocked(swapApi.getSwapQuote).mockReturnValueOnce(quote.promise);
      await user.type(screen.getByLabelText('swapSendAmount'), '2');
      await waitFor(() => expect(swapApi.getSwapQuote).toHaveBeenCalledTimes(2));
      await act(async () => {
        preparation.resolve(preparedSwap('1.24'));
      });
      const review = await screen.findByTestId('fullscreen-view');
      await act(async () => {
        quote.resolve({
          success: true,
          quote: { routes: [{ routeId: 'route-2', providers: ['NEAR'], expectedBuyAmount: '9.99' }] },
        });
      });
      expect(review).toHaveTextContent('1.24 ETH');
      expect(review).not.toHaveTextContent('9.99 ETH');
    });

    // Leaving during any preparation stage must prevent the old flow from starting device confirmation.
    it.each(['preparation', 'proposal', 'fiat'] as const)('does not sign after unmount during %s', async stage => {
      const preparation = deferred<swapApi.TSwapSignResponse>();
      const proposal = deferred<accountApi.TTxProposalResult>();
      const fiat = deferred<Awaited<ReturnType<typeof coinsApi.convertToCurrency>>>();
      if (stage === 'preparation') {
        vi.mocked(swapApi.signSwap).mockReturnValueOnce(preparation.promise);
      } else if (stage === 'proposal') {
        vi.mocked(accountApi.proposeTx).mockReturnValueOnce(proposal.promise);
      } else {
        vi.mocked(coinsApi.convertToCurrency).mockReturnValueOnce(fiat.promise);
      }
      const { unmount } = renderSwapFlow();
      await requestReview();
      unmount();
      await act(async () => {
        preparation.resolve(preparedSwap('1.24'));
        proposal.resolve({ success: false });
        fiat.resolve({ success: true, fiatAmount: '42.00' });
      });
      expect(accountApi.sendTx).not.toHaveBeenCalled();
      expect(alertUser).not.toHaveBeenCalled();
    });
  });
});
