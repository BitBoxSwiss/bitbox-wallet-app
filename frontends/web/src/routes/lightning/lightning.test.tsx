// SPDX-License-Identifier: Apache-2.0

import '../../../__mocks__/i18n';
import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as devicesApi from '@/api/devices';
import * as lightningApi from '@/api/lightning';
import { GlobalBannersContainerContext } from '@/contexts/global-banners-context';
import { Main } from '@/components/layout';
import { ConfigContext } from '@/contexts/ConfigContext';
import { RatesContext } from '@/contexts/RatesContext';
import { Lightning } from './lightning';

type TLightningState = {
  isLightningReady: boolean | undefined;
  lightningAccount: {
    code: string;
    num: number;
    rootFingerprint: string;
  } | null | undefined;
  lightningSDKStatus: lightningApi.TLightningSDKStatus | undefined;
};

const useLightningMock = vi.hoisted(() => vi.fn<() => TLightningState>());

vi.mock('@/i18n/i18n');

vi.mock('@/components/status/status', () => ({
  Status: ({ children, hidden }: { children: ReactNode; hidden?: boolean }) => hidden ? null : <div role="alert">{children}</div>,
}));

vi.mock('@/components/balance/balance', () => ({
  Balance: () => <div>Balance</div>,
}));

vi.mock('@/components/banners/lightning-tor-proxy-warning', () => ({
  LightningTorProxyWarning: () => null,
}));

vi.mock('@/components/hideamountsbutton/hideamountsbutton', () => ({
  HideAmountsButton: () => null,
}));

vi.mock('@/hooks/lightning', () => ({
  useLightning: useLightningMock,
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

const balance: lightningApi.TLightningBalance = {
  available: amount('350000'),
  fundingLimit: {
    limitSat: 200000,
    marginSat: -150000,
  },
  hasAvailable: true,
  hasIncoming: false,
  incoming: amount('0'),
};

const renderLightning = () => render(
  <MemoryRouter>
    <ConfigContext.Provider value={{ config: undefined, setConfig: vi.fn() }}>
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
    </ConfigContext.Provider>
  </MemoryRouter>
);

describe('Lightning funding limit', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useLightningMock.mockReturnValue({
      isLightningReady: true,
      lightningAccount: { code: 'v0-test-ln-0', num: 0, rootFingerprint: 'f23ab988' },
      lightningSDKStatus: 'ready',
    });
    vi.spyOn(devicesApi, 'getDeviceList').mockResolvedValue({});
    vi.spyOn(lightningApi, 'getBlockExplorerTxPrefix').mockResolvedValue('https://example.com/tx/');
    vi.spyOn(lightningApi, 'getLightningBalance').mockResolvedValue(balance);
    vi.spyOn(lightningApi, 'getListPayments').mockResolvedValue([]);
    vi.spyOn(lightningApi, 'getSparkStatus').mockResolvedValue({ status: 'operational' });
    vi.spyOn(lightningApi, 'subscribeLightningBalance').mockReturnValue(vi.fn());
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

  it('keeps global banners attached when navigating before Lightning is ready', () => {
    useLightningMock.mockReturnValue({
      isLightningReady: undefined,
      lightningAccount: undefined,
      lightningSDKStatus: undefined,
    });
    const pendingRequest = new Promise<never>(() => {});
    vi.mocked(lightningApi.getBlockExplorerTxPrefix).mockReturnValue(pendingRequest);
    vi.mocked(lightningApi.getLightningBalance).mockReturnValue(pendingRequest);
    vi.mocked(lightningApi.getSparkStatus).mockReturnValue(pendingRequest);
    const fallbackContainer = document.createElement('div');
    const globalBannersElement = document.createElement('div');
    const globalBannersContainer = {
      element: globalBannersElement,
      restore: vi.fn(() => fallbackContainer.appendChild(globalBannersElement)),
    };

    const { container } = render(
      <GlobalBannersContainerContext.Provider value={globalBannersContainer}>
        <MemoryRouter initialEntries={['/other']}>
          <ConfigContext.Provider value={{ config: undefined, setConfig: vi.fn() }}>
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
              <Routes>
                <Route path="/other" element={(
                  <Main>
                    <Link to="/lightning">Open Lightning</Link>
                  </Main>
                )} />
                <Route path="/lightning" element={<Lightning />} />
              </Routes>
            </RatesContext.Provider>
          </ConfigContext.Provider>
        </MemoryRouter>
      </GlobalBannersContainerContext.Provider>,
    );

    expect(globalBannersElement.parentElement).toBe(container.querySelector('main'));

    fireEvent.click(screen.getByRole('link', { name: 'Open Lightning' }));

    expect(screen.getByText('lightning.initializing')).toBeInTheDocument();
    expect(globalBannersElement.parentElement).toBe(container.querySelector('main'));
  });
});
