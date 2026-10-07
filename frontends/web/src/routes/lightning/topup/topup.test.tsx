// SPDX-License-Identifier: Apache-2.0

import '../../../../__mocks__/i18n';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as accountApi from '@/api/account';
import * as coinsApi from '@/api/coins';
import * as keystoresApi from '@/api/keystores';
import * as lightningApi from '@/api/lightning';
import { TLightningErrorCode } from '@/api/lightning-errors';
import { BackButtonProvider } from '@/contexts/BackButtonContext';
import { ConfigContext } from '@/contexts/ConfigContext';
import { LocalizationContext } from '@/contexts/localization-context';
import { RatesContext } from '@/contexts/RatesContext';
import { LightningTopUp } from './topup';

vi.mock('@/i18n/i18n');

vi.mock('@/routes/account/send/feetargets', () => ({
  FeeTargets: ({
    onFeeTargetChange,
  }: {
    onFeeTargetChange: (feeTarget: accountApi.FeeTargetCode) => void;
  }) => (
    <button onClick={() => onFeeTargetChange('economy')}>Set fee target</button>
  ),
}));

vi.mock('@/components/groupedaccountselector/groupedaccountselector', () => ({
  GroupedAccountSelector: ({ accounts }: { accounts: accountApi.TAccount[] }) => (
    <span data-testid="btc-accounts">{accounts.map(account => account.code).join(',')}</span>
  ),
}));

const account: accountApi.TAccount = {
  keystore: {
    watchonly: false,
    rootFingerprint: 'f23ab988',
    name: 'BitBox02',
    lastConnected: '',
    connected: true,
  },
  active: true,
  coinCode: 'btc',
  coinUnit: 'BTC',
  coinName: 'Bitcoin',
  code: 'btc-account',
  name: 'Bitcoin Account',
  isToken: false,
  blockExplorerTxPrefix: 'https://example.com/tx/',
};

const amount = (value: string): accountApi.TAmountWithConversions => ({
  amount: value,
  unit: 'sat',
  estimated: false,
});

const lightningBalance = (marginSat = 150000): lightningApi.TLightningBalance => ({
  available: amount(String(200000 - marginSat)),
  fundingLimit: {
    limitSat: 200000,
    marginSat,
  },
  hasAvailable: marginSat < 200000,
  hasIncoming: false,
  incoming: amount('0'),
});

const CurrentPath = () => {
  const { pathname } = useLocation();
  return <span data-testid="current-path">{pathname}</span>;
};

const renderTopUp = (activeAccounts = [account], hasAccounts = true) => render(
  <MemoryRouter initialEntries={['/lightning/topup']}>
    <BackButtonProvider>
      <RatesContext.Provider value={{
        defaultCurrency: 'USD',
        activeCurrencies: ['USD'],
        btcUnit: 'sat',
        rotateDefaultCurrency: vi.fn(),
        rotateBtcUnit: vi.fn(),
        addToActiveCurrencies: vi.fn(),
        updateDefaultCurrency: vi.fn(),
        removeFromActiveCurrencies: vi.fn(),
      }}>
        <LocalizationContext.Provider value={{ decimal: '.', group: ',' }}>
          <ConfigContext.Provider value={{ config: undefined, setConfig: vi.fn() }}>
            <LightningTopUp activeAccounts={activeAccounts} hasAccounts={hasAccounts} />
            <CurrentPath />
          </ConfigContext.Provider>
        </LocalizationContext.Provider>
      </RatesContext.Provider>
    </BackButtonProvider>
  </MemoryRouter>
);

describe('LightningTopUp', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(lightningApi, 'subscribeLightningBalance').mockReturnValue(vi.fn());
  });

  it('prompts to connect a BitBox without leaving Top up when there are no accounts', async () => {
    vi.spyOn(lightningApi, 'getLightningBalance').mockResolvedValue(lightningBalance());
    const connectAnyKeystore = vi.spyOn(keystoresApi, 'connectAnyKeystore').mockResolvedValue({
      success: false,
      errorCode: 'userAbort',
    });

    renderTopUp([], false);
    fireEvent.click(await screen.findByRole('button', { name: /connect/i }));

    await waitFor(() => expect(connectAnyKeystore).toHaveBeenCalledOnce());
    expect(screen.getByTestId('current-path')).toHaveTextContent('/lightning/topup');
  });

  it('opens Manage accounts when accounts exist but no Bitcoin account is active', async () => {
    vi.spyOn(lightningApi, 'getLightningBalance').mockResolvedValue(lightningBalance());
    const connectAnyKeystore = vi.spyOn(keystoresApi, 'connectAnyKeystore');

    renderTopUp([], true);
    fireEvent.click(await screen.findByRole('button', { name: /manage/i }));

    expect(screen.getByTestId('current-path')).toHaveTextContent('/settings/manage-accounts');
    expect(connectAnyKeystore).not.toHaveBeenCalled();
  });

  it('shows every Bitcoin account without loading its balance', async () => {
    const emptyAccount: accountApi.TAccount = {
      ...account,
      code: 'empty-btc-account',
      name: 'Empty Bitcoin Account',
      keystore: {
        ...account.keystore,
        connected: false,
      },
    };
    const getBalance = vi.spyOn(accountApi, 'getBalance').mockResolvedValue({
      success: true,
      balance: lightningBalance(200000),
    });
    vi.spyOn(lightningApi, 'getLightningBalance').mockResolvedValue(lightningBalance());

    renderTopUp([account, emptyAccount]);

    expect(await screen.findByTestId('btc-accounts')).toHaveTextContent('btc-account,empty-btc-account');
    expect(getBalance).not.toHaveBeenCalled();
  });

  it.each([
    { name: 'estimated claim fee', estimatedClaimFee: { ...amount('1188'), conversions: { USD: '0.75' } } },
    { name: 'unavailable claim fee', estimatedClaimFee: null },
  ])('shows $name before entering review and completes the send', async ({ estimatedClaimFee }) => {
    vi.spyOn(lightningApi, 'getLightningBalance').mockResolvedValue(lightningBalance());
    vi.spyOn(coinsApi, 'convertToCurrency').mockResolvedValue({ success: true, fiatAmount: '100' });
    vi.spyOn(keystoresApi, 'connectKeystore').mockResolvedValue({ success: true });
    const prepareTopUp = vi.spyOn(lightningApi, 'postPrepareTopUp').mockResolvedValue({
      success: true,
      amount: amount('100000'),
      estimatedClaimFee,
      fee: amount('100'),
      total: amount('100100'),
      recipientDisplayAddress: 'bc1q boarding',
    });
    let completeSend: (value: Awaited<ReturnType<typeof accountApi.sendTx>>) => void = () => {};
    const sendTx = vi.spyOn(accountApi, 'sendTx').mockReturnValue(new Promise((resolve) => {
      completeSend = resolve;
    }));

    renderTopUp();

    expect(screen.queryByText('Estimated claim fee')).not.toBeInTheDocument();
    fireEvent.input(await screen.findByLabelText('sat'), { target: { value: '100000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Set fee target' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Review' })).toBeEnabled(), {
      timeout: 2000,
    });

    expect(prepareTopUp).toHaveBeenLastCalledWith({
      amount: '100000',
      customFee: '',
      feeTarget: 'economy',
      sourceAccountCode: 'btc-account',
    });
    expect(sendTx).not.toHaveBeenCalled();
    expect(screen.getByText('Estimated claim fee')).toBeVisible();
    expect(screen.getByText(
      'Deducted from your top-up amount. The actual fee may vary with Bitcoin network conditions at claim time.'
    )).toBeVisible();
    expect(screen.getAllByTestId('amountBlocks').map(element => element.textContent)).toEqual(
      estimatedClaimFee ? ['50000', '1188'] : ['50000']
    );
    if (estimatedClaimFee) {
      expect(screen.getByText('0.75')).toBeVisible();
      expect(screen.queryByText(/Unavailable/)).not.toBeInTheDocument();
    } else {
      expect(screen.getByText(/Unavailable/)).toBeVisible();
    }
    fireEvent.click(screen.getByRole('button', { name: 'Review' }));

    await waitFor(() => expect(sendTx).toHaveBeenCalledWith('btc-account', 'Lightning top-up'));
    expect(screen.getAllByTestId('amountBlocks').map(element => element.textContent)).toEqual(
      ['100000', '100', '100100']
    );
    await act(async () => completeSend({ success: true, txId: 'tx-id' }));
    expect(await screen.findByText('Top up created!')).toBeVisible();
  });

  it('shows the funding-limit error returned by the prepare endpoint', async () => {
    vi.spyOn(lightningApi, 'getLightningBalance').mockResolvedValue(lightningBalance());
    vi.spyOn(lightningApi, 'postPrepareTopUp').mockResolvedValue({
      success: false,
      errorCode: 'lightningBalanceLimitExceeded',
      fundingLimit: {
        limitSat: 200000,
        marginSat: 50000,
      },
    });
    vi.spyOn(coinsApi, 'convertToCurrency').mockResolvedValue({ success: true, fiatAmount: '100' });
    renderTopUp();

    fireEvent.input(await screen.findByLabelText('sat'), { target: { value: '100000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Set fee target' }));

    expect(await screen.findByText(/Maximum top-up amount/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Review' })).toBeDisabled();
  });

  it('shows the minimum-amount error returned by the prepare endpoint', async () => {
    vi.spyOn(lightningApi, 'getLightningBalance').mockResolvedValue(lightningBalance());
    vi.spyOn(lightningApi, 'postPrepareTopUp').mockResolvedValue({
      success: false,
      errorCode: TLightningErrorCode.AMOUNT_BELOW_MINIMUM,
      minAmountSat: 1000,
    });
    vi.spyOn(coinsApi, 'convertToCurrency').mockResolvedValue({ success: true, fiatAmount: '0.01' });
    renderTopUp();

    fireEvent.input(await screen.findByLabelText('sat'), { target: { value: '100000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Set fee target' }));

    expect(await screen.findByLabelText('sat: The amount must be at least 1000 sats.')).toBeVisible();
    expect(screen.getByLabelText('USD')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Review' })).toBeDisabled();
  });
});
