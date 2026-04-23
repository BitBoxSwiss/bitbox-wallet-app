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
});
