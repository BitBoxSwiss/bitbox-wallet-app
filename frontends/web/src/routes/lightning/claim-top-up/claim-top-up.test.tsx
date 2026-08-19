// SPDX-License-Identifier: Apache-2.0

import '../../../../__mocks__/i18n';
import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TAccount, TAmountWithConversions } from '@/api/account';
import type { TLightningPayment } from '@/api/lightning';
import * as lightningApi from '@/api/lightning';
import { TLightningErrorCode, TSdkError } from '@/api/lightning-errors';
import { BackButtonProvider } from '@/contexts/BackButtonContext';
import { LightningClaimTopUp } from './claim-top-up';

vi.mock('@/components/layout', () => ({
  Header: ({ title }: { title: ReactNode }) => <div>{title}</div>,
  Main: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));

vi.mock('@/components/amount/amount-with-unit', () => ({
  AmountWithUnit: ({ amount: displayedAmount }: { amount?: TAmountWithConversions }) => (
    <span>{displayedAmount?.amount}</span>
  ),
}));

vi.mock('@/components/groupedaccountselector/groupedaccountselector', () => ({
  GroupedAccountSelector: () => <div />,
}));

vi.mock('@/api/lightning', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/lightning')>();
  return {
    ...actual,
    getListPayments: vi.fn(),
    postClaimTopUp: vi.fn(),
    postRefundTopUp: vi.fn(),
  };
});

const paymentID = 'bitcoin-deposit:deposit-txid:1';

const bitcoinAccount = {
  active: true,
  blockExplorerTxPrefix: '',
  code: 'btc-0',
  coinCode: 'btc',
} as TAccount;

const amount = (value: string): TAmountWithConversions => ({
  amount: value,
  conversions: {},
  estimated: false,
  unit: 'sat',
});

const deposit = (
  claimFeeSat: number,
  refundFeeRateSatPerVbyte?: number,
): TLightningPayment => ({
  id: paymentID,
  type: 'receive',
  status: 'pending',
  time: null,
  amount: amount('10000'),
  amountAtTime: amount('10000'),
  deductedAmountAtTime: amount('0'),
  fee: amount('0'),
  bitcoinDeposit: {
    txid: 'deposit-txid',
    state: 'unclaimed',
    claimFee: amount(String(claimFeeSat)),
    claimFeeSat,
    refundFeeRateSatPerVbyte,
  },
});

describe('routes/lightning/claim-top-up', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reloads and requires approval of an increased claim fee', async () => {
    vi.mocked(lightningApi.getListPayments)
      .mockResolvedValueOnce([deposit(100)])
      .mockResolvedValueOnce([deposit(200)]);
    vi.mocked(lightningApi.postClaimTopUp)
      .mockRejectedValueOnce(new TSdkError(
        TLightningErrorCode.PAYMENT_APPROVAL_REQUIRED,
        TLightningErrorCode.PAYMENT_APPROVAL_REQUIRED,
      ))
      .mockResolvedValueOnce({ txId: 'claim-txid' });

    render(
      <MemoryRouter initialEntries={[`/lightning/claim-top-up?paymentId=${encodeURIComponent(paymentID)}`]}>
        <BackButtonProvider>
          <LightningClaimTopUp activeAccounts={[]} />
        </BackButtonProvider>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'lightning.claimTopUp.claimButton' }));
    fireEvent.click(screen.getByRole('button', { name: 'lightning.claimTopUp.confirm.claimButton' }));

    expect(await screen.findByText('error.paymentApprovalRequired')).toBeInTheDocument();
    await waitFor(() => expect(lightningApi.getListPayments).toHaveBeenCalledTimes(2));
    expect(lightningApi.postClaimTopUp).toHaveBeenLastCalledWith(paymentID, 100);
    expect(await screen.findAllByText('200')).not.toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'lightning.claimTopUp.confirm.claimButton' }));

    await waitFor(() => expect(lightningApi.postClaimTopUp).toHaveBeenLastCalledWith(paymentID, 200));
  });

  it('opens the refund confirmation without a destination account', async () => {
    vi.mocked(lightningApi.getListPayments).mockResolvedValue([deposit(100, 2)]);

    render(
      <MemoryRouter initialEntries={[`/lightning/claim-top-up?paymentId=${encodeURIComponent(paymentID)}`]}>
        <BackButtonProvider>
          <LightningClaimTopUp activeAccounts={[]} />
        </BackButtonProvider>
      </MemoryRouter>
    );

    const refundButton = await screen.findByRole('button', {
      name: 'lightning.claimTopUp.refundButton',
    });
    expect(refundButton).toBeEnabled();

    fireEvent.click(refundButton);

    expect(screen.getByText('lightning.claimTopUp.confirm.refundDestination')).toBeInTheDocument();
    expect(screen.getByRole('button', {
      name: 'lightning.claimTopUp.confirm.refundButton',
    })).toBeDisabled();
  });

  it('clears the claim error before opening the refund confirmation', async () => {
    vi.mocked(lightningApi.getListPayments).mockResolvedValue([deposit(100, 2)]);
    vi.mocked(lightningApi.postClaimTopUp).mockRejectedValue(new TSdkError(
      TLightningErrorCode.TOP_UP_CLAIM_FAILED,
      TLightningErrorCode.TOP_UP_CLAIM_FAILED,
    ));

    render(
      <MemoryRouter initialEntries={[`/lightning/claim-top-up?paymentId=${encodeURIComponent(paymentID)}`]}>
        <BackButtonProvider>
          <LightningClaimTopUp activeAccounts={[bitcoinAccount]} />
        </BackButtonProvider>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'lightning.claimTopUp.claimButton' }));
    fireEvent.click(screen.getByRole('button', { name: 'lightning.claimTopUp.confirm.claimButton' }));
    fireEvent.click(await screen.findByRole('button', { name: 'lightning.claimTopUp.refundButton' }));

    expect(screen.getByText('lightning.claimTopUp.confirm.refundDestination')).toBeInTheDocument();
    expect(screen.queryByText('error.lightningTopUpClaimFailed')).not.toBeInTheDocument();
  });

  it('reloads and requires approval of an increased refund fee rate', async () => {
    vi.mocked(lightningApi.getListPayments)
      .mockResolvedValueOnce([deposit(100, 2)])
      .mockResolvedValueOnce([deposit(100, 3)]);
    vi.mocked(lightningApi.postRefundTopUp)
      .mockRejectedValueOnce(new TSdkError(
        TLightningErrorCode.PAYMENT_APPROVAL_REQUIRED,
        TLightningErrorCode.PAYMENT_APPROVAL_REQUIRED,
      ))
      .mockResolvedValueOnce({ txId: 'refund-txid' });

    render(
      <MemoryRouter initialEntries={[`/lightning/claim-top-up?paymentId=${encodeURIComponent(paymentID)}`]}>
        <BackButtonProvider>
          <LightningClaimTopUp activeAccounts={[bitcoinAccount]} />
        </BackButtonProvider>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'lightning.claimTopUp.refundButton' }));
    fireEvent.click(screen.getByRole('button', { name: 'lightning.claimTopUp.confirm.refundButton' }));

    expect(await screen.findByText('error.paymentApprovalRequired')).toBeInTheDocument();
    await waitFor(() => expect(lightningApi.getListPayments).toHaveBeenCalledTimes(2));
    expect(lightningApi.postRefundTopUp).toHaveBeenLastCalledWith(paymentID, bitcoinAccount.code, 2);

    fireEvent.click(await screen.findByRole('button', { name: 'lightning.claimTopUp.confirm.refundButton' }));

    await waitFor(() => expect(lightningApi.postRefundTopUp).toHaveBeenLastCalledWith(
      paymentID,
      bitcoinAccount.code,
      3,
    ));
  });
});
