// SPDX-License-Identifier: Apache-2.0

import '../../../__mocks__/i18n';
import type { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TBalance } from '@/api/account';
import * as devicesApi from '@/api/devices';
import * as lightningApi from '@/api/lightning';
import { RatesContext } from '@/contexts/RatesContext';
import { Lightning } from './lightning';

vi.mock('@/i18n/i18n');

vi.mock('@/components/status/status', () => ({
  Status: ({ children, hidden }: { children: ReactNode; hidden?: boolean }) => hidden ? null : <div role="alert">{children}</div>,
}));

vi.mock('@/components/balance/balance', () => ({
  Balance: () => <div>Balance</div>,
}));

vi.mock('@/components/banners', () => ({
  GlobalBanners: () => null,
}));

vi.mock('@/components/hideamountsbutton/hideamountsbutton', () => ({
  HideAmountsButton: () => null,
}));

vi.mock('@/hooks/lightning', () => ({
  useLightning: () => ({
    isLightningReady: true,
    lightningAccount: { code: 'v0-test-ln-0', num: 0, rootFingerprint: 'f23ab988' },
  }),
}));

vi.mock('@/hooks/mediaquery', () => ({
  useMediaQuery: () => false,
}));

vi.mock('./components/payment-details', () => ({
  PaymentDetails: () => null,
}));

vi.mock('./guide', () => ({
  LightningGuide: () => null,
}));

const amount = (value: string) => ({
  amount: value,
  estimated: false,
  unit: 'sat' as const,
});

const balance: TBalance = {
  available: amount('350000'),
  hasAvailable: true,
  hasIncoming: false,
  incoming: amount('0'),
};

const balanceLimit: lightningApi.TLightningBalanceLimit = {
  amount: amount('200000'),
  amountLabel: '200000 sat',
  remainingAmount: amount('0'),
  remainingAmountLabel: '0 sat',
  excessAmount: amount('150000'),
  excessAmountLabel: '150000 sat',
  limitReached: true,
  limitExceeded: true,
  amountExceedsLimit: false,
};

const renderLightning = () => render(
  <MemoryRouter>
    <RatesContext.Provider value={{
      defaultCurrency: 'EUR',
      activeCurrencies: ['EUR'],
      btcUnit: 'sat',
      rotateDefaultCurrency: vi.fn(),
      rotateBtcUnit: vi.fn(),
      addToActiveCurrencies: vi.fn(),
      updateDefaultCurrency: vi.fn(),
      removeFromActiveCurrencies: vi.fn(),
    }}>
      <Lightning />
    </RatesContext.Provider>
  </MemoryRouter>
);

describe('Lightning balance limit', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(devicesApi, 'getDeviceList').mockResolvedValue({});
    vi.spyOn(lightningApi, 'getBlockExplorerTxPrefix').mockResolvedValue('https://example.com/tx/');
    vi.spyOn(lightningApi, 'getLightningBalance').mockResolvedValue(balance);
    vi.spyOn(lightningApi, 'getLightningBalanceLimit').mockResolvedValue(balanceLimit);
    vi.spyOn(lightningApi, 'getListPayments').mockResolvedValue([]);
    vi.spyOn(lightningApi, 'getSparkStatus').mockResolvedValue({ status: 'operational' });
    vi.spyOn(lightningApi, 'subscribeListPayments').mockReturnValue(vi.fn());
  });

  it('warns above the limit, links to send, and disables top up', async () => {
    const { container } = renderLightning();

    await waitFor(() => {
      expect(screen.getByText('lightning.limit.accountWarning')).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: 'lightning.limit.moveCoins' })).toHaveAttribute('href', '/lightning/send');
    expect(container.querySelector('a[href="/lightning/receive"]')).toBeInTheDocument();
    expect(container.querySelector('a[href="/lightning/topup"]')).not.toBeInTheDocument();
  });

  it('does not warn at the exact limit', async () => {
    vi.spyOn(lightningApi, 'getLightningBalanceLimit').mockResolvedValue({
      ...balanceLimit,
      excessAmount: amount('0'),
      excessAmountLabel: '0 sat',
      limitExceeded: false,
    });

    const { container } = renderLightning();

    await waitFor(() => expect(lightningApi.getLightningBalanceLimit).toHaveBeenCalled());
    expect(screen.queryByText('lightning.limit.accountWarning')).not.toBeInTheDocument();
    expect(container.querySelector('a[href="/lightning/topup"]')).not.toBeInTheDocument();
  });
});
