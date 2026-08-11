// SPDX-License-Identifier: Apache-2.0

import '../../../../__mocks__/i18n';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as accountApi from '@/api/account';
import * as coinsApi from '@/api/coins';
import * as keystoresApi from '@/api/keystores';
import * as lightningApi from '@/api/lightning';
import { TLightningErrorCode } from '@/api/lightning-errors';
import { RatesContext } from '@/contexts/RatesContext';
import { LightningTopUp } from './topup';

vi.mock('@/i18n/i18n');

vi.mock('./topup-form', () => ({
  TopUpForm: ({
    balanceLimitError,
    btcAccounts,
    canReview,
    errorHandling,
    minimumAmountError,
    onAmountChange,
    onFeeTargetChange,
    onReview,
    sendError,
  }: {
    balanceLimitError?: string;
    btcAccounts: accountApi.TAccount[];
    canReview: boolean;
    errorHandling: { amountError?: string };
    minimumAmountError?: string;
    onAmountChange: (amount: string) => void;
    onFeeTargetChange: (feeTarget: accountApi.FeeTargetCode) => void;
    onReview: () => void;
    sendError?: string;
  }) => (
    <>
      <button onClick={() => onAmountChange('100000')}>Set amount</button>
      <button onClick={() => onFeeTargetChange('economy')}>Set fee target</button>
      <button disabled={!canReview} onClick={onReview}>Review</button>
      <span data-testid="btc-accounts">{btcAccounts.map(account => account.code).join(',')}</span>
      <span data-testid="balance-limit-error">{balanceLimitError}</span>
      <span data-testid="amount-error">{minimumAmountError || errorHandling.amountError}</span>
      <span data-testid="fiat-amount-error">{errorHandling.amountError}</span>
      <span data-testid="send-error">{sendError}</span>
    </>
  ),
}));

vi.mock('./topup-confirm', () => ({
  TopUpConfirm: () => <div>Confirm top-up</div>,
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

const renderTopUp = (activeAccounts = [account]) => render(
  <MemoryRouter>
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
      <LightningTopUp activeAccounts={activeAccounts} hasAccounts />
    </RatesContext.Provider>
  </MemoryRouter>
);

describe('LightningTopUp', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(lightningApi, 'subscribeLightningBalance').mockReturnValue(vi.fn());
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

  it('prepares and sends a top-up through the dedicated endpoint', async () => {
    vi.spyOn(lightningApi, 'getLightningBalance').mockResolvedValue(lightningBalance());
    vi.spyOn(coinsApi, 'convertToCurrency').mockResolvedValue({ success: true, fiatAmount: '100' });
    vi.spyOn(keystoresApi, 'connectKeystore').mockResolvedValue({ success: true });
    const prepareTopUp = vi.spyOn(lightningApi, 'postPrepareTopUp').mockResolvedValue({
      success: true,
      amount: amount('100000'),
      fee: amount('100'),
      total: amount('100100'),
      recipientDisplayAddress: 'bc1q boarding',
    });
    const sendTx = vi.spyOn(accountApi, 'sendTx').mockResolvedValue({ success: true, txId: 'tx-id' });

    renderTopUp();

    fireEvent.click(await screen.findByRole('button', { name: 'Set amount' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Review' }));

    await waitFor(() => expect(sendTx).toHaveBeenCalledWith('btc-account', 'Lightning top-up'));
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

    fireEvent.click(await screen.findByRole('button', { name: 'Set amount' }));
    fireEvent.click(screen.getByRole('button', { name: 'Set fee target' }));

    await waitFor(() => expect(screen.getByTestId('balance-limit-error')).toHaveTextContent('Maximum top-up amount'));
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

    fireEvent.click(await screen.findByRole('button', { name: 'Set amount' }));
    fireEvent.click(screen.getByRole('button', { name: 'Set fee target' }));

    await waitFor(() => expect(screen.getByTestId('amount-error')).toHaveTextContent(
      'The amount must be at least 1000 sats.'
    ));
    expect(screen.getByTestId('fiat-amount-error')).toBeEmptyDOMElement();
    expect(screen.getByRole('button', { name: 'Review' })).toBeDisabled();
  });
});
