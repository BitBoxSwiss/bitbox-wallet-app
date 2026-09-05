// SPDX-License-Identifier: Apache-2.0

import '../../../../__mocks__/i18n';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { CoinCode, CoinFormattedAmount, CoinUnit, Fiat, TChartData } from '@/api/account';
import { AppContext } from '@/contexts/AppContext';
import { LocalizationContext } from '@/contexts/localization-context';
import { RatesContext } from '@/contexts/RatesContext';
import { TotalBalanceForAllKeystores } from './total-balance-for-all-keystores';

vi.mock('@/hooks/mediaquery', () => ({
  useMediaQuery: vi.fn().mockReturnValue(false),
}));

vi.mock('@/hooks/coin-unit-price', () => ({
  useCoinUnitPrice: vi.fn(() => ({
    amount: '1',
    unit: 'BTC',
    conversions: {
      BTC: '1',
      sat: '100000000',
      USD: '60000.00',
    },
    estimated: false,
  })),
}));

const chartData = (chartFiat: Fiat): TChartData => ({
  chartDataMissing: false,
  chartDataDaily: [],
  chartDataHourly: [],
  chartFiat,
  chartTotal: 1,
  formattedChartTotal: '1',
  chartIsUpToDate: true,
  lastTimestamp: 0,
});

const btcBalance = {
  coinCode: 'btc',
  coinName: 'Bitcoin',
  formattedAmount: {
    amount: '1.00000000',
    unit: 'BTC',
    conversions: {
      BTC: '1',
      sat: '100000000',
      USD: '60000.00',
    },
    estimated: false,
  },
} satisfies CoinFormattedAmount;

const bitcoinBalance = (
  coinCode: CoinCode,
  coinName: string,
  unit: CoinUnit,
): CoinFormattedAmount => ({
  ...btcBalance,
  coinCode,
  coinName,
  formattedAmount: {
    ...btcBalance.formattedAmount,
    unit,
  },
});

type TProps = {
  children: ReactNode;
  defaultCurrency: Fiat;
};

const Wrapper = ({
  children,
  defaultCurrency,
}: TProps) => (
  <AppContext.Provider value={{
    activeSidebar: false,
    chartDisplay: 'year',
    firmwareUpdateDialogOpen: false,
    guideExists: false,
    guideShown: false,
    hideAmounts: false,
    isDevServers: false,
    isTesting: false,
    nativeLocale: 'en-US',
    sessionConfig: {},
    setActiveSidebar: vi.fn(),
    setChartDisplay: vi.fn(),
    setFirmwareUpdateDialogOpen: vi.fn(),
    setGuideExists: vi.fn(),
    setHideAmounts: vi.fn(),
    setVendorIframeActive: vi.fn(),
    toggleGuide: vi.fn(),
    toggleHideAmounts: vi.fn(),
    toggleSidebar: vi.fn(),
    updateSessionConfig: vi.fn(),
    vendorIframeActive: false,
  }}>
    <LocalizationContext.Provider value={{ decimal: '.', group: '\'' }}>
      <RatesContext.Provider value={{
        activeCurrencies: [defaultCurrency],
        addToActiveCurrencies: vi.fn(),
        btcUnit: 'default',
        defaultCurrency,
        removeFromActiveCurrencies: vi.fn(),
        rotateBtcUnit: vi.fn(),
        rotateDefaultCurrency: vi.fn(),
        updateDefaultCurrency: vi.fn(),
      }}>
        {children}
      </RatesContext.Provider>
    </LocalizationContext.Provider>
  </AppContext.Provider>
);

const renderTotalAssets = (
  defaultCurrency: Fiat,
  balance: CoinFormattedAmount = btcBalance,
) => render(
  <MemoryRouter>
    <Wrapper defaultCurrency={defaultCurrency}>
      <TotalBalanceForAllKeystores
        summaryData={chartData(defaultCurrency)}
        coinsBalances={[balance]}
      />
    </Wrapper>
  </MemoryRouter>
);

describe('TotalBalanceForAllKeystores', () => {
  it('hides the BTC unit price when the display currency is BTC', () => {
    renderTotalAssets('BTC');

    expect(screen.queryByTestId('unit-price-amount')).not.toBeInTheDocument();
  });

  it('hides the BTC unit price when the display currency is sat', () => {
    renderTotalAssets('sat');

    expect(screen.queryByTestId('unit-price-amount')).not.toBeInTheDocument();
  });

  it('hides the Bitcoin Testnet unit price when the display currency is BTC', () => {
    renderTotalAssets('BTC', bitcoinBalance('tbtc', 'Bitcoin Testnet', 'TBTC'));

    expect(screen.queryByTestId('unit-price-amount')).not.toBeInTheDocument();
  });

  it('shows the BTC unit price for fiat display currencies', () => {
    renderTotalAssets('USD');

    expect(screen.getByTestId('unit-price-amount')).toHaveTextContent('60000 USD');
  });
});
