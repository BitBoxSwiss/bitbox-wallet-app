// SPDX-License-Identifier: Apache-2.0

import '../../../../__mocks__/i18n';
import type { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as accountApi from '@/api/account';
import * as lightningApi from '@/api/lightning';
import { AppContext } from '@/contexts/AppContext';
import { RatesContext } from '@/contexts/RatesContext';
import { AccountsSummary } from './accountssummary';

vi.mock('@/components/guide/entry', () => ({ Entry: () => null }));
vi.mock('@/components/guide/guide', () => ({ Guide: () => null }));
vi.mock('@/components/banners/backup', () => ({ BackupReminder: () => null }));
vi.mock('@/components/banners/offline-error', () => ({ OfflineError: () => null }));
vi.mock('@/components/status/status', () => ({
  Status: ({ children, hidden }: { children: ReactNode; hidden?: boolean }) => (
    hidden ? null : <div role="alert">{children}</div>
  ),
}));

const lightningHookState = vi.hoisted(() => ({
  account: { code: 'v0-test-ln-0', num: 0, rootFingerprint: 'f23ab988' },
  state: 'failed' as 'failed' | 'ready',
}));

vi.mock('@/hooks/lightning', () => ({
  useLightning: () => ({
    isLightningReady: lightningHookState.state === 'ready',
    lightningAccount: lightningHookState.account,
    lightningStatus: { state: lightningHookState.state },
  }),
}));
vi.mock('./chart', () => ({
  Chart: ({ data }: { data?: accountApi.TChartData }) => (
    <div data-testid="chart-total">{data?.formattedChartTotal}</div>
  ),
}));
vi.mock('./total-balance-for-all-keystores', () => ({
  TotalBalanceForAllKeystores: ({ coinsBalances }: { coinsBalances?: accountApi.CoinFormattedAmount[] }) => (
    <div data-testid="coin-balances">
      {coinsBalances?.map(balance => balance.coinCode).join(',') ?? 'loading'}
    </div>
  ),
}));
vi.mock('./keystorebalance', () => ({
  KeystoreBalance: () => null,
}));

const partialChartData: accountApi.TChartData = {
  chartDataDaily: [],
  chartDataHourly: [],
  chartDataMissing: false,
  chartFiat: 'USD',
  chartIsUpToDate: true,
  chartTotal: 60000,
  formattedChartTotal: '60,000.00',
  lastTimestamp: 0,
  unavailableCoinCodes: ['lightning'],
};

const readyChartData: accountApi.TChartData = {
  ...partialChartData,
  chartTotal: 60025,
  formattedChartTotal: '60,025.00',
  unavailableCoinCodes: [],
};

const btcBalance: accountApi.CoinFormattedAmount = {
  coinCode: 'btc',
  coinName: 'Bitcoin',
  formattedAmount: {
    amount: '1.00000000',
    conversions: { USD: '60000.00' },
    estimated: false,
    unit: 'BTC',
  },
};

const lightningBalance: accountApi.CoinFormattedAmount = {
  coinCode: 'lightning',
  coinName: 'Lightning',
  formattedAmount: {
    amount: '2500',
    conversions: { USD: '25.00' },
    estimated: false,
    unit: 'sat',
  },
};

const btcAccount: accountApi.TAccount = {
  active: true,
  blockExplorerTxPrefix: 'https://example.com/tx/',
  code: 'btc-account',
  coinCode: 'btc',
  coinName: 'Bitcoin',
  coinUnit: 'BTC',
  isToken: false,
  keystore: {
    connected: true,
    lastConnected: '',
    name: 'BitBox02',
    rootFingerprint: 'f23ab988',
    watchonly: false,
  },
  name: 'Bitcoin Account',
};

const accounts = [btcAccount];

const partialBalanceSummary: accountApi.TAccountsBalanceSummary = {
  coinsTotalBalance: [btcBalance],
  keystoresBalance: {},
  unavailableCoinCodes: ['lightning'],
};

const readyBalanceSummary: accountApi.TAccountsBalanceSummary = {
  coinsTotalBalance: [btcBalance, lightningBalance],
  keystoresBalance: {},
  unavailableCoinCodes: [],
};

let chartDataResponse = partialChartData;
let balanceSummaryResponse = partialBalanceSummary;

const appContext = {
  activeSidebar: false,
  chartDisplay: 'year' as const,
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
};

const TestProviders = ({ children }: { children: ReactNode }) => (
  <MemoryRouter>
    <AppContext.Provider value={appContext}>
      <RatesContext.Provider value={{
        activeCurrencies: ['USD'],
        addToActiveCurrencies: vi.fn(),
        btcUnit: 'default',
        defaultCurrency: 'USD',
        removeFromActiveCurrencies: vi.fn(),
        rotateBtcUnit: vi.fn(),
        rotateDefaultCurrency: vi.fn(),
        updateDefaultCurrency: vi.fn(),
      }}>
        {children}
      </RatesContext.Provider>
    </AppContext.Provider>
  </MemoryRouter>
);

const AccountSummaryUnderTest = () => (
  <TestProviders>
    <AccountsSummary accounts={accounts} />
  </TestProviders>
);

describe('AccountsSummary', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    lightningHookState.state = 'failed';
    chartDataResponse = partialChartData;
    balanceSummaryResponse = partialBalanceSummary;
    vi.spyOn(accountApi, 'getChartData').mockImplementation(async () => ({
      success: true,
      data: chartDataResponse,
    }));
    vi.spyOn(accountApi, 'getAccountsBalanceSummary').mockImplementation(async () => ({
      success: true,
      accountsBalanceSummary: balanceSummaryResponse,
    }));
    vi.spyOn(accountApi, 'getStatus').mockResolvedValue({
      disabled: true,
      fatalError: false,
      offlineError: null,
      synced: false,
    });
    vi.spyOn(lightningApi, 'subscribeLightningBalance').mockReturnValue(vi.fn());
  });

  it('keeps available portfolio data when Lightning is unavailable', async () => {
    render(<AccountSummaryUnderTest />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('accountSummary.lightningUnavailable');
    });
    expect(screen.getByTestId('chart-total')).toHaveTextContent('60,000.00');
    expect(screen.getByTestId('coin-balances')).toHaveTextContent('btc');
    expect(screen.getByTestId('coin-balances')).not.toHaveTextContent('lightning');
  });

  it('refreshes complete portfolio data when Lightning recovers', async () => {
    const { rerender } = render(<AccountSummaryUnderTest />);

    await screen.findByRole('alert');
    const chartCallsBeforeRecovery = vi.mocked(accountApi.getChartData).mock.calls.length;
    const summaryCallsBeforeRecovery = vi.mocked(accountApi.getAccountsBalanceSummary).mock.calls.length;

    lightningHookState.state = 'ready';
    chartDataResponse = readyChartData;
    balanceSummaryResponse = readyBalanceSummary;
    rerender(<AccountSummaryUnderTest />);

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByTestId('chart-total')).toHaveTextContent('60,025.00');
      expect(screen.getByTestId('coin-balances')).toHaveTextContent('btc,lightning');
    });
    expect(accountApi.getChartData).toHaveBeenCalledTimes(chartCallsBeforeRecovery + 1);
    expect(accountApi.getAccountsBalanceSummary).toHaveBeenCalledTimes(summaryCallsBeforeRecovery + 1);
  });

  it('does not show an unavailable warning when Lightning is ready', async () => {
    lightningHookState.state = 'ready';
    chartDataResponse = readyChartData;
    balanceSummaryResponse = readyBalanceSummary;

    render(<AccountSummaryUnderTest />);

    await waitFor(() => {
      expect(screen.getByTestId('chart-total')).toHaveTextContent('60,025.00');
      expect(screen.getByTestId('coin-balances')).toHaveTextContent('btc,lightning');
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
