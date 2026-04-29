// SPDX-License-Identifier: Apache-2.0

import '../../../../__mocks__/i18n';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/i18n/i18n');
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
    hasSwapPaymentRequest: vi.fn(),
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
vi.mock('@/utils/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/config')>();
  return {
    ...actual,
    getConfig: vi.fn(),
  };
});

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import * as accountApi from '@/api/account';
import * as coinsApi from '@/api/coins';
import * as swapApi from '@/api/swap';
import * as config from '@/utils/config';
import { RatesContext } from '@/contexts/RatesContext';
import { Swap } from './swap';

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

const usdcAccount: accountApi.TAccount = {
  keystore: sellAccount.keystore,
  active: true,
  blockExplorerTxPrefix: '',
  code: 'usdc-account',
  coinCode: 'eth-erc20-usdc',
  coinName: 'USD Coin',
  coinUnit: 'USDC',
  isToken: true,
  name: 'USDC Account',
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

const swapUSDCSellAccount: swapApi.TSwapAccount = {
  active: true,
  code: 'usdc-account',
  coinCode: 'eth-erc20-usdc',
  coinUnit: 'USDC',
  isToken: true,
  keystore: usdcAccount.keystore,
  name: 'USDC Account',
  parentAccountCode: 'eth-account',
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

const swapTxInput: accountApi.TTxInput = {
  address: 'bc1qswapaddress',
  amount: '1',
  paymentRequest: null,
  selectedUTXOs: [],
  sendAll: 'no',
  useHighestFee: true,
};

const successfulProposal: Extract<accountApi.TTxProposalResult, { success: true }> = {
  success: true,
  amount: {
    amount: '1',
    conversions: {},
    estimated: false,
    unit: 'BTC',
  },
  fee: {
    amount: '0.001',
    conversions: {
      USD: '42',
    },
    estimated: true,
    unit: 'BTC',
  },
  recipientDisplayAddress: 'bc1qswapaddress',
  total: {
    amount: '1.001',
    conversions: {},
    estimated: false,
    unit: 'BTC',
  },
};

const balance: accountApi.TBalance = {
  hasAvailable: true,
  available: {
    amount: '1',
    conversions: {},
    estimated: false,
    unit: 'BTC',
  },
  hasIncoming: false,
  incoming: {
    amount: '0',
    conversions: {},
    estimated: false,
    unit: 'BTC',
  },
};

const usdcBalance: accountApi.TBalance = {
  hasAvailable: true,
  available: {
    amount: '2',
    conversions: {},
    estimated: false,
    unit: 'USDC',
  },
  hasIncoming: false,
  incoming: {
    amount: '0',
    conversions: {},
    estimated: false,
    unit: 'USDC',
  },
};

describe('routes/market/swap', () => {
  beforeEach(() => {
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

    vi.mocked(accountApi.getBalance).mockResolvedValue({ success: true, balance });
    vi.mocked(accountApi.hasSwapPaymentRequest).mockResolvedValue({ success: true });
    vi.mocked(accountApi.proposeTx).mockResolvedValue(successfulProposal);
    vi.mocked(accountApi.sendTx).mockResolvedValue({ success: true, txId: 'tx-id' });
    vi.mocked(coinsApi.parseExternalBtcAmount).mockResolvedValue({ success: false, amount: '' });
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
    vi.mocked(swapApi.signSwap).mockResolvedValue({
      success: true,
      expectedBuyAmount: '1.23',
      swapId: 'swap-id',
      txInput: swapTxInput,
    });
    vi.mocked(config.getConfig).mockResolvedValue({
      frontend: {},
      backend: {},
    });
  });

  it('renders grouped provider label after quote fetch', async () => {
    const user = userEvent.setup();

    render(
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
        <MemoryRouter>
          <Swap accounts={[sellAccount, buyAccount]} />
        </MemoryRouter>
      </RatesContext.Provider>,
    );

    const agreeButton = await screen.findByTestId('agree-swap-terms');
    await user.click(agreeButton);

    expect(screen.getByText(/Network fee/)).toBeInTheDocument();
    expect(screen.getByText('Not available')).toBeInTheDocument();

    await user.type(await screen.findByLabelText('swapSendAmount'), '1');

    expect(await screen.findByText('THORChain + Mayachain')).toBeInTheDocument();
    await waitFor(() => {
      expect(swapApi.getSwapQuote).toHaveBeenCalledWith({
        buyCoinCode: 'eth',
        sellAccountCode: 'btc-account',
        sellAmount: '1',
        sellCoinCode: 'btc',
      });
    });
    await waitFor(() => {
      expect(swapApi.signSwap).toHaveBeenCalledWith({
        buyAccountCode: 'eth-account',
        preview: true,
        routeId: 'route-1',
        sellAccountCode: 'btc-account',
        sellAmount: '1',
      });
      expect(accountApi.proposeTx).toHaveBeenCalledWith('btc-account', swapTxInput);
    });
    expect(screen.getByText(/Network fee/)).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('does not show route while fee preview is pending', async () => {
    const user = userEvent.setup();

    vi.mocked(swapApi.signSwap).mockImplementation(() => new Promise(() => {}));

    render(
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
        <MemoryRouter>
          <Swap accounts={[sellAccount, buyAccount]} />
        </MemoryRouter>
      </RatesContext.Provider>,
    );

    await user.click(await screen.findByTestId('agree-swap-terms'));
    await user.type(await screen.findByLabelText('swapSendAmount'), '1');

    await waitFor(() => expect(swapApi.signSwap).toHaveBeenCalled());
    expect(screen.queryByText('THORChain + Mayachain')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Swap' })).toBeDisabled();
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
      errorCode: 'NoRoutesFoundError',
      errorData: {
        buyCoin: 'USDC',
        sellCoin: 'ETH',
      },
      errorMessage: 'No routes found for ETH.ETH to ETH.USDC-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    });

    render(
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
        <MemoryRouter>
          <Swap accounts={[buyAccount]} />
        </MemoryRouter>
      </RatesContext.Provider>,
    );

    await user.click(await screen.findByTestId('agree-swap-terms'));
    await user.type(await screen.findByLabelText('swapSendAmount'), '1');

    expect(await screen.findByText('No route found from ETH to USDC. Try entering a larger amount. Otherwise try again later.')).toBeInTheDocument();
    expect(screen.queryByText(/ETH\.ETH/)).not.toBeInTheDocument();
    expect(screen.queryByText(/ETH\.USDC/)).not.toBeInTheDocument();
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
        <MemoryRouter>
          <Swap accounts={[sellAccount, buyAccount]} />
        </MemoryRouter>
      </RatesContext.Provider>,
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

  it('shows insufficient funds warning when fee preview fails', async () => {
    const user = userEvent.setup();

    vi.mocked(accountApi.proposeTx).mockResolvedValue({
      success: false,
      errorCode: 'insufficientFunds',
    });

    render(
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
        <MemoryRouter>
          <Swap accounts={[sellAccount, buyAccount]} />
        </MemoryRouter>
      </RatesContext.Provider>,
    );

    await user.click(await screen.findByTestId('agree-swap-terms'));
    await user.type(await screen.findByLabelText('swapSendAmount'), '1');

    expect(await screen.findByText(/network fee/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/^Network fee/)).toBeInTheDocument();
      expect(screen.getByText('Not available')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Swap' })).toBeDisabled();
  });

  it('shows ERC20 gas funds error when token fee preview fails', async () => {
    const user = userEvent.setup();

    vi.mocked(swapApi.getSwapAccounts).mockResolvedValue({
      success: true,
      sellAccounts: [swapUSDCSellAccount],
      buyAccounts: [swapBuyAccount],
      defaultSellAccountCode: swapUSDCSellAccount.code,
      defaultBuyAccountCode: swapBuyAccount.code,
    });
    vi.mocked(accountApi.proposeTx).mockResolvedValue({
      success: false,
      errorCode: 'erc20InsufficientGasFunds',
    });
    vi.mocked(accountApi.getBalance).mockResolvedValue({
      success: true,
      balance: usdcBalance,
    });

    render(
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
        <MemoryRouter>
          <Swap accounts={[usdcAccount, buyAccount]} />
        </MemoryRouter>
      </RatesContext.Provider>,
    );

    await user.click(await screen.findByTestId('agree-swap-terms'));
    await user.type(await screen.findByLabelText('swapSendAmount'), '1');

    expect(await screen.findByText(/enough Ether/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Buy ETH' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Swap' })).toBeDisabled();
    expect(accountApi.getBalance).not.toHaveBeenCalledWith('eth-account');
  });

  it('signs and sends swap after fee preview', async () => {
    const user = userEvent.setup();

    render(
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
        <MemoryRouter>
          <Swap accounts={[sellAccount, buyAccount]} />
        </MemoryRouter>
      </RatesContext.Provider>,
    );

    await user.click(await screen.findByTestId('agree-swap-terms'));
    await user.type(await screen.findByLabelText('swapSendAmount'), '1');

    const swapButton = screen.getByRole('button', { name: 'Swap' });
    await waitFor(() => expect(swapButton).toBeEnabled());

    vi.mocked(swapApi.signSwap).mockClear();
    vi.mocked(accountApi.proposeTx).mockClear();

    await user.click(swapButton);

    await waitFor(() => {
      expect(swapApi.signSwap).toHaveBeenCalledWith({
        buyAccountCode: 'eth-account',
        routeId: 'route-1',
        sellAccountCode: 'btc-account',
        sellAmount: '1',
      });
      expect(accountApi.hasSwapPaymentRequest).toHaveBeenCalledWith('btc-account');
      expect(accountApi.proposeTx).toHaveBeenCalledWith('btc-account', swapTxInput);
      expect(accountApi.sendTx).toHaveBeenCalledWith('btc-account', 'Swap SwapKit');
    });
  });
});
