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
vi.mock('@/api/accountsync', () => ({
  syncdone: vi.fn(() => vi.fn()),
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
    getUTXOs: vi.fn(),
    getUTXOsAmount: vi.fn(),
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
vi.mock('@/contexts/ConfigProvider', () => ({
  useConfig: vi.fn(() => ({
    config: { frontend: {}, backend: {} } as TConfig,
    setConfig: vi.fn(),
  })),
}));

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import * as accountApi from '@/api/account';
import * as coinsApi from '@/api/coins';
import * as swapApi from '@/api/swap';
import { useConfig } from '@/contexts/ConfigProvider';
import { RatesContext } from '@/contexts/RatesContext';
import { Swap } from './swap';

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
    vi.mocked(accountApi.getUTXOs).mockResolvedValue([]);
    vi.mocked(accountApi.getUTXOsAmount).mockResolvedValue({ success: false });
    vi.mocked(accountApi.hasSwapPaymentRequest).mockResolvedValue({ success: true });
    vi.mocked(accountApi.proposeTx).mockResolvedValue({
      success: true,
      amount: { amount: '1', estimated: false, unit: 'BTC' },
      fee: { amount: '0.0001', estimated: false, unit: 'BTC' },
      recipientDisplayAddress: 'bc1qswap',
      total: { amount: '1.0001', estimated: false, unit: 'BTC' },
    });
    vi.mocked(accountApi.sendTx).mockResolvedValue({ success: true, txId: 'txid' });
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
      txInput: {
        address: 'bc1qswap',
        amount: '1',
        paymentRequest: null,
        selectedUTXOs: [],
        sendAll: 'no',
        useHighestFee: true,
      },
    });
    mockUseConfig.mockReturnValue({
      config: { frontend: {}, backend: {} } as TConfig,
      setConfig: vi.fn(),
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
  });

  it('prefills the sell amount from selected UTXOs when the checkbox is checked', async () => {
    const user = userEvent.setup();

    mockUseConfig.mockReturnValue({
      config: {
        backend: {},
        frontend: {
          coinControl: true,
        },
      } as TConfig,
      setConfig: vi.fn(),
    });
    vi.mocked(accountApi.getUTXOs).mockResolvedValue([
      {
        address: 'bc1qselectedaddress',
        addressReused: false,
        amount: {
          amount: '123',
          estimated: false,
          unit: 'BTC',
        },
        headerTimestamp: null,
        isChange: false,
        note: '',
        outPoint: 'txid1:0',
        scriptType: 'p2wpkh',
        txId: 'txid1',
        txOutput: 0,
      },
      {
        address: 'bc1qselectedaddress',
        addressReused: false,
        amount: {
          amount: '456',
          estimated: false,
          unit: 'BTC',
        },
        headerTimestamp: null,
        isChange: false,
        note: '',
        outPoint: 'txid2:1',
        scriptType: 'p2wpkh',
        txId: 'txid2',
        txOutput: 1,
      },
    ]);
    let resolveUpdatedUTXOsAmount: (
      result: Awaited<ReturnType<typeof accountApi.getUTXOsAmount>>
    ) => void = () => {};
    vi.mocked(accountApi.getUTXOsAmount)
      .mockResolvedValueOnce({
        success: true,
        amount: {
          amount: '0.30000003',
          estimated: false,
          unit: 'BTC',
        },
      })
      .mockReturnValueOnce(new Promise(resolve => {
        resolveUpdatedUTXOsAmount = resolve;
      }));

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
    expect(screen.queryByRole('checkbox', { name: 'Send selected coins' })).not.toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Coin control' }));

    const checkboxes = await screen.findAllByRole('checkbox');
    await user.click(checkboxes[0]!);
    await user.click(checkboxes[1]!);

    expect(accountApi.getUTXOsAmount).not.toHaveBeenCalled();
    const useSelectedUTXOsCheckbox = await screen.findByRole('checkbox', { name: 'Send selected coins' });
    expect(useSelectedUTXOsCheckbox).toBeEnabled();
    await user.type(screen.getByLabelText('swapSendAmount'), '0.5');
    await user.click(useSelectedUTXOsCheckbox);

    await waitFor(() => {
      expect(accountApi.getUTXOsAmount).toHaveBeenLastCalledWith(
        'btc-account',
        ['txid1:0', 'txid2:1'],
      );
    });
    expect(screen.getByTestId('swapSendAmount')).toHaveTextContent('0.30000003');
    expect(screen.queryByLabelText('swapSendAmount')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(swapApi.getSwapQuote).toHaveBeenCalledWith({
        buyCoinCode: 'eth',
        sellAccountCode: 'btc-account',
        sellAmount: '0.30000003',
        sellCoinCode: 'btc',
      });
    });
    const swapButton = screen.getByRole('button', { name: 'Swap' });
    await waitFor(() => expect(swapButton).toBeEnabled());
    await user.click(checkboxes[1]!);
    await waitFor(() => {
      expect(accountApi.getUTXOsAmount).toHaveBeenLastCalledWith(
        'btc-account',
        ['txid1:0'],
      );
    });
    await waitFor(() => {
      expect(screen.getByTestId('swapSendAmount')).toBeEmptyDOMElement();
      expect(swapButton).toBeDisabled();
    });
    resolveUpdatedUTXOsAmount({
      success: true,
      amount: {
        amount: '0.10000000',
        estimated: false,
        unit: 'BTC',
      },
    });
    await waitFor(() => {
      expect(screen.getByTestId('swapSendAmount')).toHaveTextContent('0.10000000');
    });
    await waitFor(() => {
      expect(swapApi.getSwapQuote).toHaveBeenCalledWith({
        buyCoinCode: 'eth',
        sellAccountCode: 'btc-account',
        sellAmount: '0.10000000',
        sellCoinCode: 'btc',
      });
    });
    await waitFor(() => expect(swapButton).toBeEnabled());
    await user.click(swapButton);
    await waitFor(() => {
      expect(swapApi.signSwap).toHaveBeenLastCalledWith({
        buyAccountCode: 'eth-account',
        routeId: 'route-1',
        sellAccountCode: 'btc-account',
        sellAmount: '0.10000000',
        selectedUTXOs: ['txid1:0'],
      });
    });

    await user.click(screen.getByRole('checkbox', { name: 'Send selected coins' }));
    expect(screen.getByLabelText('swapSendAmount')).toHaveValue('0.5');
    await waitFor(() => {
      expect(swapApi.getSwapQuote).toHaveBeenCalledWith({
        buyCoinCode: 'eth',
        sellAccountCode: 'btc-account',
        sellAmount: '0.5',
        sellCoinCode: 'btc',
      });
    });
    await waitFor(() => expect(swapButton).toBeEnabled());
    await user.click(swapButton);
    await waitFor(() => {
      expect(swapApi.signSwap).toHaveBeenLastCalledWith({
        buyAccountCode: 'eth-account',
        routeId: 'route-1',
        sellAccountCode: 'btc-account',
        sellAmount: '0.5',
        selectedUTXOs: [],
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
      errorCode: 'noRoutesFound',
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

  it('shows insufficient funds warning together with no-route errors', async () => {
    const user = userEvent.setup();

    vi.mocked(swapApi.getSwapQuote).mockResolvedValue({
      success: false,
      errorCode: 'noRoutesFound',
      errorData: {
        buyCoin: 'ETH',
        sellCoin: 'BTC',
      },
      errorMessage: 'No routes found',
      validationErrorCode: 'insufficientFunds',
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
    await user.type(await screen.findByLabelText('swapSendAmount'), '2');

    expect(await screen.findByText('No route found from BTC to ETH. Try entering a larger amount. Otherwise try again later.')).toBeInTheDocument();
    expect(screen.getByText(/insufficient funds/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Swap' })).toBeDisabled();
  });

  it('keeps quote output visible for insufficient funds', async () => {
    const user = userEvent.setup();

    vi.mocked(swapApi.getSwapQuote).mockResolvedValue({
      success: false,
      errorCode: 'insufficientFunds',
      errorMessage: 'insufficientFunds',
      quote: {
        routes: [{
          expectedBuyAmount: '1.23',
          providers: ['thorchain', 'mayachain'],
          routeId: 'route-1',
        }],
      },
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
    await user.type(await screen.findByLabelText('swapSendAmount'), '2');

    expect(await screen.findByText('THORChain + Mayachain')).toBeInTheDocument();
    expect(await screen.findByTestId('swapGetAmount')).toHaveTextContent('1.23');
    expect(screen.getByText(/insufficient funds/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Swap' })).toBeDisabled();
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
});
