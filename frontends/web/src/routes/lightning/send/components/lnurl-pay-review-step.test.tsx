// SPDX-License-Identifier: Apache-2.0

import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/components/status/status', () => ({
  Status: ({ children, hidden }: { children: ReactNode; hidden?: boolean }) => hidden
    ? null
    : <div role="status">{children}</div>,
}));
vi.mock('@/components/backbutton/backbutton', () => ({
  DesktopBackButton: ({ children, onClick }: { children: ReactNode; onClick: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
}));
vi.mock('./custom-payment-amount', () => ({
  CustomPaymentAmount: () => <div>amount</div>,
}));
vi.mock('./payment-input-details', () => ({
  LNURLPayRecipientDetails: () => <div>recipient</div>,
  PaymentFeeDetails: () => <div>fees</div>,
}));
vi.mock('./sending-spinner', () => ({
  SendingSpinner: () => <div>sending</div>,
}));
vi.mock('../hooks/use-payment-review', () => ({
  usePaymentReview: vi.fn(),
}));

import { usePaymentReview } from '../hooks/use-payment-review';
import { LNURLPayReviewStep } from './lnurl-pay-review-step';

type THookResult = ReturnType<typeof usePaymentReview>;

const idempotencyKey = '00000000-0000-4000-8000-000000000001';
const sendPayment = vi.fn();
const startNewLNURLPayment = vi.fn();

const renderReview = (
  preparedPayment: THookResult['preparedPayment'],
  canSend = false,
) => {
  vi.mocked(usePaymentReview).mockReturnValue({
    amountError: undefined,
    canSend,
    fees: preparedPayment?.status === 'ready' || preparedPayment?.status === 'unknown'
      ? preparedPayment.fees
      : undefined,
    isSending: false,
    preparedPayment,
    sendError: undefined,
    sendPayment,
    setCustomAmount: vi.fn(),
    startNewLNURLPayment,
  });
  render(<LNURLPayReviewStep
    lnurlPay={{
      input: 'alice@example.com',
      domain: 'example.com',
      minAmountSat: 1,
      maxAmountSat: 1_000,
    }}
    backToPaymentInput={vi.fn()}
    onSendingChange={vi.fn()}
    onSuccess={vi.fn()}
  />);
};

describe('LNURLPayReviewStep', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('shows the normal send review for unknown attempts', () => {
    renderReview({
      status: 'unknown',
      amountSat: 100,
      idempotencyKey,
      fees: { amountSat: 100, feeSat: 2, totalDebitSat: 102 },
    }, true);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByText('fees')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'generic.send' }));

    expect(sendPayment).toHaveBeenCalledOnce();
  });

  it('shows only a disabled waiting action while payment is pending', () => {
    renderReview({ status: 'pending', amountSat: 100, idempotencyKey });

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'lightning.send.lnurlPay.waiting' })).toBeDisabled();
  });

  it('starts a new reviewed attempt after completion', () => {
    renderReview({ status: 'completed', amountSat: 100, idempotencyKey });

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'lightning.send.lnurlPay.sendAnother' }));

    expect(startNewLNURLPayment).toHaveBeenCalledOnce();
    expect(sendPayment).not.toHaveBeenCalled();
  });

  it('starts a new reviewed attempt after failure', () => {
    renderReview({ status: 'failed', amountSat: 100, idempotencyKey });

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'lightning.send.lnurlPay.tryAgain' }));

    expect(startNewLNURLPayment).toHaveBeenCalledOnce();
    expect(sendPayment).not.toHaveBeenCalled();
  });
});
