// SPDX-License-Identifier: Apache-2.0

import { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { CoinCode, CoinUnit, Fiat } from '@/api/account';
import { AppContext } from '@/contexts/AppContext';
import { LocalizationContext } from '@/contexts/localization-context';
import { RatesContext } from '@/contexts/RatesContext';
import { useCoinUnitPrice } from '@/hooks/coin-unit-price';
import { AssetBalanceWithUnitPrice } from './asset-balance-with-unit-price';

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

const renderAssetBalance = (
  defaultCurrency: Fiat,
  coinCode: CoinCode,
  coinName: string,
  unit: CoinUnit,
  showUnitPrice?: boolean,
) => render(
  <Wrapper defaultCurrency={defaultCurrency}>
    <AssetBalanceWithUnitPrice
      amount={{
        amount: '0.99951787',
        unit,
        conversions: {
          BTC: '0.99951787',
          sat: '99951787',
          USD: '59971.07',
        },
        estimated: false,
      }}
      coinCode={coinCode}
      coinName={coinName}
      showUnitPrice={showUnitPrice}
    />
  </Wrapper>
);

const mockUseCoinUnitPrice = vi.mocked(useCoinUnitPrice);

describe('AssetBalanceWithUnitPrice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hides Bitcoin Testnet unit prices when the display currency is BTC', () => {
    renderAssetBalance('BTC', 'tbtc', 'Bitcoin Testnet', 'TBTC');

    expect(screen.queryByTestId('unit-price-amount')).not.toBeInTheDocument();
  });

  it('hides Bitcoin unit prices when the display currency is sat', () => {
    renderAssetBalance('sat', 'btc', 'Bitcoin', 'BTC');

    expect(screen.queryByTestId('unit-price-amount')).not.toBeInTheDocument();
  });

  it('hides unit prices when showUnitPrice is false', () => {
    renderAssetBalance('USD', 'btc', 'Bitcoin', 'BTC', false);

    expect(screen.queryByTestId('unit-price-amount')).not.toBeInTheDocument();
  });

  it('shows Bitcoin unit prices for fiat display currencies', () => {
    renderAssetBalance('USD', 'btc', 'Bitcoin', 'BTC');

    expect(screen.getByTestId('unit-price-amount')).toHaveTextContent('60000 USD');
    expect(mockUseCoinUnitPrice).toHaveBeenCalledWith('btc', 'BTC');
  });
});
