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
import { RatesContext } from '@/contexts/RatesContext';
import { LightningTopUp } from './topup';

vi.mock('@/i18n/i18n');

vi.mock('./topup-form', () => ({
  TopUpForm: ({
    balanceLimitError,
    canReview,
    onAmountChange,
    onFeeTargetChange,
    onReview,
    sendError,
  }: {
    balanceLimitError?: string;
    canReview: boolean;
    onAmountChange: (amount: string) => void;
    onFeeTargetChange: (feeTarget: accountApi.FeeTargetCode) => void;
    onReview: () => void;
    sendError?: string;
  }) => (
    <>
      <button onClick={() => onAmountChange('100000')}>Set amount</button>
      <button onClick={() => onFeeTargetChange('economy')}>Set fee target</button>
      <button disabled={!canReview} onClick={onReview}>Review</button>
      <span data-testid="balance-limit-error">{balanceLimitError}</span>
      <span data-testid="send-error">{sendError}</span>
    </>
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

const balance: accountApi.TBalance = {
  hasAvailable: true,
  available: amount('50000'),
  hasIncoming: false,
  incoming: amount('0'),
};

const balanceLimit = ({
  amountExceedsLimit = false,
  limitReached = false,
}: {
  amountExceedsLimit?: boolean;
  limitReached?: boolean;
} = {}): lightningApi.TLightningBalanceLimit => {
  let remaining = '150000';
  if (limitReached) {
    remaining = '0';
  } else if (amountExceedsLimit) {
    remaining = '50000';
  }
  return {
    amount: amount('200000'),
    amountLabel: '200000 sat',
    remainingAmount: amount(remaining),
    remainingAmountLabel: `${remaining} sat`,
    excessAmount: amount(amountExceedsLimit ? '50000' : '0'),
    excessAmountLabel: amountExceedsLimit ? '50000 sat' : '0 sat',
    limitReached,
    limitExceeded: false,
    amountExceedsLimit,
  };
};

const renderTopUp = () => render(
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
      <LightningTopUp activeAccounts={[account]} hasAccounts />
    </RatesContext.Provider>
  </MemoryRouter>
);

describe('LightningTopUp', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('revalidates the balance limit before sending the top-up', async () => {
    let rejectTopUp = false;
    const getBalanceLimit = vi.spyOn(lightningApi, 'getLightningBalanceLimit')
      .mockImplementation(async () => balanceLimit({ amountExceedsLimit: rejectTopUp }));
    const getBalance = vi.spyOn(lightningApi, 'getLightningBalance').mockResolvedValue(balance);
    vi.spyOn(lightningApi, 'getBoardingAddress').mockResolvedValue('bc1qboarding');
    vi.spyOn(coinsApi, 'convertToCurrency').mockResolvedValue({ success: true, fiatAmount: '100' });
    vi.spyOn(keystoresApi, 'connectKeystore').mockResolvedValue({ success: true });
    vi.spyOn(accountApi, 'proposeTx').mockResolvedValue({
      success: true,
      amount: amount('100000'),
      fee: amount('100'),
      total: amount('100100'),
      recipientDisplayAddress: 'bc1q boarding',
    });
    const sendTx = vi.spyOn(accountApi, 'sendTx').mockResolvedValue({ success: true, txId: 'tx-id' });

    renderTopUp();

    fireEvent.click(screen.getByRole('button', { name: 'Set amount' }));
    fireEvent.click(screen.getByRole('button', { name: 'Set fee target' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Review' })).toBeEnabled(), {
      timeout: 2000,
    });

    rejectTopUp = true;
    fireEvent.click(screen.getByRole('button', { name: 'Review' }));

    await waitFor(() => expect(screen.getByTestId('balance-limit-error')).not.toBeEmptyDOMElement());
    expect(getBalanceLimit).toHaveBeenLastCalledWith({ amount: '100000', unit: 'sat' });
    expect(getBalance).toHaveBeenCalledTimes(1);
    expect(sendTx).not.toHaveBeenCalled();
  });

  it('shows the balance-limit error and disables review inside the top-up page', async () => {
    vi.spyOn(lightningApi, 'getLightningBalanceLimit').mockResolvedValue(balanceLimit({
      amountExceedsLimit: true,
      limitReached: true,
    }));
    vi.spyOn(lightningApi, 'getLightningBalance').mockResolvedValue(balance);
    vi.spyOn(coinsApi, 'convertToCurrency').mockResolvedValue({ success: true, fiatAmount: '100' });
    renderTopUp();

    fireEvent.click(screen.getByRole('button', { name: 'Set amount' }));

    await waitFor(() => expect(screen.getByTestId('balance-limit-error')).toHaveTextContent('Maximum top-up amount'));
    expect(screen.getByRole('button', { name: 'Review' })).toBeDisabled();
  });
});
