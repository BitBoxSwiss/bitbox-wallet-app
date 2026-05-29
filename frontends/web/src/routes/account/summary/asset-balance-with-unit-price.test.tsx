// SPDX-License-Identifier: Apache-2.0

import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TAmountWithConversions } from '@/api/account';
import { useCoinUnitPrice } from '@/hooks/coin-unit-price';
import { AssetBalanceWithUnitPrice } from './asset-balance-with-unit-price';

vi.mock('@/hooks/coin-unit-price', () => ({
  useCoinUnitPrice: vi.fn(),
}));

vi.mock('@/components/amount/amount-with-unit', () => ({
  AmountWithUnit: ({ amount }: { amount?: TAmountWithConversions }) => (
    <span>{amount?.amount}</span>
  ),
}));

vi.mock('@/components/icon/logo', () => ({
  Logo: ({ className, coinCode }: { className?: string; coinCode: string }) => (
    <span className={className} data-testid="asset-logo">{coinCode}</span>
  ),
}));

const mockUseCoinUnitPrice = vi.mocked(useCoinUnitPrice);

const amount: TAmountWithConversions = {
  amount: '0.00010000',
  conversions: { USD: '10.00' },
  estimated: false,
  unit: 'BTC',
};

const ethAmount: TAmountWithConversions = {
  amount: '1',
  conversions: { USD: '100.00' },
  estimated: false,
  unit: 'ETH',
};

describe('AssetBalanceWithUnitPrice', () => {
  beforeEach(() => {
    mockUseCoinUnitPrice.mockReset();
    mockUseCoinUnitPrice.mockReturnValue(undefined);
  });

  it('passes the asset coin code to the unit price hook', () => {
    const { getByTestId } = render(
      <AssetBalanceWithUnitPrice
        amount={amount}
        coinCode="lightning"
        coinName="Lightning"
      />
    );

    expect(mockUseCoinUnitPrice).toHaveBeenCalledWith('lightning', 'BTC');
    expect(getByTestId('asset-logo').className).toContain('assetBalanceLogo');
  });

  it('uses the asset unit price for regular coins', () => {
    render(
      <AssetBalanceWithUnitPrice
        amount={ethAmount}
        coinCode="eth"
        coinName="Ethereum"
      />
    );

    expect(mockUseCoinUnitPrice).toHaveBeenCalledWith('eth', 'ETH');
  });
});
