// SPDX-License-Identifier: Apache-2.0

import '../../../../__mocks__/i18n';
import type { ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TAccount, TAmountWithConversions } from '@/api/account';
import type { TLightningPayment } from '@/api/lightning';
import * as lightningApi from '@/api/lightning';
import { TLightningErrorCode, TSdkError } from '@/api/lightning-errors';
import { BackButtonProvider } from '@/contexts/BackButtonContext';
import { LightningClaimTopUp } from './claim-top-up';

vi.mock('@/components/layout', async () => {
  const { Header } = await import('@/components/layout/header');
  return {
    Header,
    Main: ({ children }: { children: ReactNode }) => <main>{children}</main>,
  };
});

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
    expect(await screen.findByText('lightning.claimTopUp.failure.claimFailedMessage')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'dialog.cancel' })).toBeInTheDocument();
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

  it('allows back from confirmation but blocks Android back while submitting', async () => {
    vi.mocked(window.matchMedia).mockImplementation(query => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    vi.mocked(lightningApi.getListPayments).mockResolvedValue([deposit(100)]);
    let resolveClaim: (result: { txId: string }) => void = () => {};
    vi.mocked(lightningApi.postClaimTopUp).mockReturnValue(new Promise(resolve => {
      resolveClaim = resolve;
    }));

    render(
      <MemoryRouter initialEntries={[`/lightning/claim-top-up?paymentId=${encodeURIComponent(paymentID)}`]}>
        <BackButtonProvider>
          <LightningClaimTopUp activeAccounts={[]} />
        </BackButtonProvider>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'lightning.claimTopUp.claimButton' }));
    expect(screen.getByText('lightning.claimTopUp.confirm.claimTitle')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'button.back' })).toBeInTheDocument();
    act(() => {
      expect(window.onBackButtonPressed?.()).toBe(false);
    });
    expect(screen.getByRole('button', { name: 'lightning.claimTopUp.claimButton' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'lightning.claimTopUp.claimButton' }));
    const confirmButton = screen.getByRole('button', { name: 'lightning.claimTopUp.confirm.claimButton' });
    fireEvent.click(confirmButton);
    await waitFor(() => expect(lightningApi.postClaimTopUp).toHaveBeenCalledOnce());

    expect(screen.queryByRole('button', { name: 'button.back' })).not.toBeInTheDocument();
    act(() => {
      expect(window.onBackButtonPressed?.()).toBe(false);
    });
    expect(confirmButton).toBeDisabled();
    expect(screen.getByText('lightning.claimTopUp.confirm.claimTitle')).toBeInTheDocument();

    await act(async () => {
      resolveClaim({ txId: 'claim-txid' });
    });
    expect(await screen.findByText('lightning.claimTopUp.success.settledMessage')).toBeInTheDocument();
  });

  // Successful SDK calls can settle, submit, or defer a claim; the screen must report each outcome.
  it.each(['settled', 'submitted', 'deferred'] as const)('shows the %s claim outcome', async claimOutcome => {
    vi.mocked(lightningApi.getListPayments).mockResolvedValue([deposit(100)]);
    vi.mocked(lightningApi.postClaimTopUp).mockResolvedValue({ claimOutcome });

    render(
      <MemoryRouter initialEntries={[`/lightning/claim-top-up?paymentId=${encodeURIComponent(paymentID)}`]}>
        <BackButtonProvider>
          <LightningClaimTopUp activeAccounts={[]} />
        </BackButtonProvider>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'lightning.claimTopUp.claimButton' }));
    fireEvent.click(screen.getByRole('button', { name: 'lightning.claimTopUp.confirm.claimButton' }));

    expect(await screen.findByText(`lightning.claimTopUp.success.${claimOutcome}Message`)).toBeInTheDocument();
    expect(screen.getByText(`lightning.claimTopUp.success.${claimOutcome}Note`)).toBeInTheDocument();
  });

  // The backend accepts a refund once it is stored, even while broadcast retries continue.
  // Show the normal confirmation without reloading the deposit or asking the user to retry.
  it('confirms an accepted refund without rechecking its broadcast state', async () => {
    vi.mocked(lightningApi.getListPayments).mockResolvedValue([deposit(100, 2)]);
    vi.mocked(lightningApi.postRefundTopUp).mockResolvedValueOnce({ txId: 'refund-txid' });

    render(
      <MemoryRouter initialEntries={[`/lightning/claim-top-up?paymentId=${encodeURIComponent(paymentID)}`]}>
        <BackButtonProvider>
          <LightningClaimTopUp activeAccounts={[bitcoinAccount]} />
        </BackButtonProvider>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'lightning.claimTopUp.refundButton' }));
    fireEvent.click(screen.getByRole('button', { name: 'lightning.claimTopUp.confirm.refundButton' }));

    expect(await screen.findByText('lightning.claimTopUp.success.refundMessage')).toBeInTheDocument();
    expect(screen.queryByText('lightning.claimTopUp.failure.refundFailedMessage')).not.toBeInTheDocument();
    expect(screen.queryByText('lightning.claimTopUp.refundPending')).not.toBeInTheDocument();
    expect(lightningApi.getListPayments).toHaveBeenCalledTimes(1);
    expect(lightningApi.postRefundTopUp).toHaveBeenCalledTimes(1);
  });

  // A refund API error is a failure; the frontend does not reclassify it from a subsequent list lookup.
  it('shows a refund failure without waiting for the deposit reload', async () => {
    vi.mocked(lightningApi.getListPayments)
      .mockResolvedValueOnce([deposit(100, 2)])
      .mockImplementationOnce(() => new Promise(() => {}));
    vi.mocked(lightningApi.postRefundTopUp).mockRejectedValueOnce(new TSdkError(
      TLightningErrorCode.TOP_UP_REFUND_FAILED,
      TLightningErrorCode.TOP_UP_REFUND_FAILED,
    ));

    render(
      <MemoryRouter initialEntries={[`/lightning/claim-top-up?paymentId=${encodeURIComponent(paymentID)}`]}>
        <BackButtonProvider>
          <LightningClaimTopUp activeAccounts={[bitcoinAccount]} />
        </BackButtonProvider>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'lightning.claimTopUp.refundButton' }));
    fireEvent.click(screen.getByRole('button', { name: 'lightning.claimTopUp.confirm.refundButton' }));

    expect(await screen.findByText('lightning.claimTopUp.failure.refundFailedMessage')).toBeInTheDocument();
    expect(screen.queryByText('lightning.claimTopUp.refundPending')).not.toBeInTheDocument();
    expect(lightningApi.postRefundTopUp).toHaveBeenCalledTimes(1);
  });

  // A signed refund awaiting broadcast remains recoverable through the existing refund flow only.
  it('allows retrying a pending refund without allowing a claim', async () => {
    vi.mocked(lightningApi.getListPayments).mockResolvedValue([{
      ...deposit(100, 2),
      bitcoinDeposit: {
        txid: 'deposit-txid',
        state: 'refundPending',
        refundFeeRateSatPerVbyte: 2,
      },
    }]);
    vi.mocked(lightningApi.postRefundTopUp).mockResolvedValue({ txId: 'refund-txid' });

    render(
      <MemoryRouter initialEntries={[`/lightning/claim-top-up?paymentId=${encodeURIComponent(paymentID)}`]}>
        <BackButtonProvider>
          <LightningClaimTopUp activeAccounts={[bitcoinAccount]} />
        </BackButtonProvider>
      </MemoryRouter>
    );

    expect(await screen.findByText('lightning.claimTopUp.refundPending')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'lightning.claimTopUp.claimButton' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'lightning.claimTopUp.refundButton' }));
    fireEvent.click(screen.getByRole('button', { name: 'lightning.claimTopUp.confirm.refundButton' }));

    expect(await screen.findByText('lightning.claimTopUp.success.refundMessage')).toBeInTheDocument();
    expect(lightningApi.postRefundTopUp).toHaveBeenCalledWith(paymentID, bitcoinAccount.code, 2);
  });
});
