// SPDX-License-Identifier: Apache-2.0

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as lightningApi from '@/api/lightning';
import { TLightningErrorCode, TSdkError } from '@/api/lightning-errors';
import { type TPaymentReviewDetails, usePaymentReview } from './use-payment-review';

const { t } = vi.hoisted(() => ({
  t: (key: string) => key,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t }),
}));
vi.mock('@/api/lightning', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/api/lightning')>(),
  postPreparePayment: vi.fn(),
  postSendPayment: vi.fn(),
}));

const paymentDetails = {
  type: lightningApi.TPaymentInputType.LNURL_PAY,
  details: {
    input: 'alice@example.com',
    domain: 'example.com',
    minAmountSat: 1,
    maxAmountSat: 1_000,
  },
} as const;

const idempotencyKey = '00000000-0000-4000-8000-000000000001';

const preparedPayment = (idempotencyKey: string) => ({
  amountSat: 100,
  feeSat: 2,
  idempotencyKey,
  totalDebitSat: 102,
});

const sendRequest = {
  type: lightningApi.TPaymentInputType.LNURL_PAY,
  paymentInput: 'alice@example.com',
  amountSat: 100,
  approvedFeeSat: 2,
  idempotencyKey,
};

const renderPaymentReview = () => {
  const backToPaymentInput = vi.fn();
  const onSendingChange = vi.fn();
  const onSuccess = vi.fn();
  return renderHook(() => usePaymentReview({
    paymentDetails,
    backToPaymentInput,
    onSendingChange,
    onSuccess,
  }));
};

const enterAmount = async (result: ReturnType<typeof renderPaymentReview>['result']) => {
  act(() => result.current.setCustomAmount(100));
  await waitFor(() => expect(result.current.preparedPayment?.status).toBe('ready'));
};

describe('usePaymentReview LNURL idempotency', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('sends the idempotency key returned by prepare', async () => {
    vi.mocked(lightningApi.postPreparePayment).mockResolvedValue(preparedPayment(idempotencyKey));
    vi.mocked(lightningApi.postSendPayment).mockResolvedValue();
    const { result } = renderPaymentReview();

    await enterAmount(result);
    await act(async () => result.current.sendPayment());

    expect(lightningApi.postSendPayment).toHaveBeenCalledWith(sendRequest);
  });

  it('reuses the same idempotency key after an ambiguous send error', async () => {
    vi.mocked(lightningApi.postPreparePayment).mockResolvedValue(preparedPayment(idempotencyKey));
    vi.mocked(lightningApi.postSendPayment)
      .mockRejectedValueOnce(new Error('response lost'))
      .mockResolvedValueOnce();
    const { result } = renderPaymentReview();

    await enterAmount(result);
    await act(async () => result.current.sendPayment());
    await act(async () => result.current.sendPayment());

    expect(lightningApi.postPreparePayment).toHaveBeenCalledTimes(1);
    expect(lightningApi.postSendPayment).toHaveBeenNthCalledWith(1, sendRequest);
    expect(lightningApi.postSendPayment).toHaveBeenNthCalledWith(2, sendRequest);
  });

  it('reuses the same idempotency key when the fee must be prepared again', async () => {
    vi.mocked(lightningApi.postPreparePayment).mockResolvedValue(preparedPayment(idempotencyKey));
    vi.mocked(lightningApi.postSendPayment).mockRejectedValue(new TSdkError(
      'fee changed',
      TLightningErrorCode.PAYMENT_APPROVAL_REQUIRED,
    ));
    const { result } = renderPaymentReview();

    await enterAmount(result);
    await act(async () => result.current.sendPayment());

    expect(lightningApi.postPreparePayment).toHaveBeenLastCalledWith({
      type: lightningApi.TPaymentInputType.LNURL_PAY,
      paymentInput: 'alice@example.com',
      amountSat: 100,
      idempotencyKey,
    });
  });
});

const sendAllDestinations: TPaymentReviewDetails[] = [
  paymentDetails,
  { type: lightningApi.TPaymentInputType.BOLT11, details: { invoice: 'lnbc1amountless' } },
  { type: lightningApi.TPaymentInputType.BITCOIN_ADDRESS, details: { address: 'bc1recipient' } },
];

describe('usePaymentReview send all', () => {
  beforeEach(() => vi.resetAllMocks());

  it.each(sendAllDestinations)('sends the reviewed debit for $type', async (paymentDetails) => {
    vi.mocked(lightningApi.postPreparePayment).mockResolvedValue({
      amountSat: 998, feeSat: 2, totalDebitSat: 1_000, idempotencyKey,
    });
    vi.mocked(lightningApi.postSendPayment).mockResolvedValue();
    const props = { paymentDetails, backToPaymentInput: vi.fn(), onSendingChange: vi.fn(), onSuccess: vi.fn() };
    const { result } = renderHook(() => usePaymentReview(props));

    act(() => result.current.setSendAll(true));
    await waitFor(() => expect(result.current.canSend).toBe(true));
    expect(lightningApi.postPreparePayment).toHaveBeenCalledWith(expect.objectContaining({
      type: paymentDetails.type, sendAll: true, amountSat: undefined,
    }));
    await act(async () => result.current.sendPayment());
    expect(lightningApi.postSendPayment).toHaveBeenCalledWith(expect.objectContaining({
      type: paymentDetails.type, sendAll: true, amountSat: 1_000, approvedFeeSat: 2,
    }));
  });

  it('preserves the debit and idempotency key when approving higher fees', async () => {
    vi.mocked(lightningApi.postPreparePayment).mockResolvedValue({
      amountSat: 998, feeSat: 2, totalDebitSat: 1_000, idempotencyKey,
    });
    vi.mocked(lightningApi.postSendPayment).mockRejectedValue(new TSdkError(
      'fee changed', TLightningErrorCode.PAYMENT_APPROVAL_REQUIRED,
    ));
    const { result } = renderPaymentReview();
    act(() => result.current.setSendAll(true));
    await waitFor(() => expect(result.current.canSend).toBe(true));
    vi.mocked(lightningApi.postPreparePayment).mockResolvedValue({
      amountSat: 997, feeSat: 3, totalDebitSat: 1_000, idempotencyKey,
    });
    await act(async () => result.current.sendPayment());
    expect(lightningApi.postPreparePayment).toHaveBeenLastCalledWith({
      type: lightningApi.TPaymentInputType.LNURL_PAY, paymentInput: 'alice@example.com',
      sendAll: true, amountSat: 1_000, idempotencyKey,
    });
    expect(result.current.fees?.amountSat).toBe(997);
    expect(result.current.canSend).toBe(true);
  });

  it.each(['resolve', 'reject'] as const)('ignores stale send-all quotes that %s after toggling twice', async (settle) => {
    let resolveOld: (value: lightningApi.TPreparePaymentResponse) => void = () => {};
    let rejectOld: (error: Error) => void = () => {};
    vi.mocked(lightningApi.postPreparePayment).mockReturnValueOnce(new Promise((resolve, reject) => {
      resolveOld = resolve;
      rejectOld = reject;
    })).mockResolvedValue({ amountSat: 998, feeSat: 2, totalDebitSat: 1_000, idempotencyKey });
    const { result } = renderPaymentReview();
    act(() => result.current.setSendAll(true));
    await waitFor(() => expect(lightningApi.postPreparePayment).toHaveBeenCalledTimes(1));
    act(() => result.current.setSendAll(false));
    expect(result.current.canSend).toBe(false);
    act(() => result.current.setSendAll(true));
    await waitFor(() => expect(result.current.canSend).toBe(true));
    await act(async () => {
      if (settle === 'resolve') {
        resolveOld({ amountSat: 99, feeSat: 1, totalDebitSat: 100 });
      } else {
        rejectOld(new Error('old request failed'));
      }
    });
    expect(result.current.fees?.totalDebitSat).toBe(1_000);
    expect(result.current.canSend).toBe(true);
  });

  it('restores the custom amount after disabling send all', async () => {
    vi.mocked(lightningApi.postPreparePayment).mockResolvedValue(preparedPayment(idempotencyKey));
    const { result } = renderPaymentReview();
    await enterAmount(result);
    act(() => result.current.setSendAll(true));
    await waitFor(() => expect(lightningApi.postPreparePayment).toHaveBeenCalledTimes(2));
    act(() => result.current.setSendAll(false));
    await waitFor(() => expect(result.current.canSend).toBe(true));
    expect(lightningApi.postPreparePayment).toHaveBeenLastCalledWith({
      type: lightningApi.TPaymentInputType.LNURL_PAY, paymentInput: 'alice@example.com',
      amountSat: 100, idempotencyKey: undefined,
    });
  });

  it('keeps the same quote when a previous custom amount finishes debouncing', async () => {
    vi.mocked(lightningApi.postPreparePayment).mockResolvedValue({
      amountSat: 998, feeSat: 2, totalDebitSat: 1_000, idempotencyKey,
    });
    const { result } = renderPaymentReview();
    act(() => result.current.setCustomAmount(100));
    act(() => result.current.setSendAll(true));
    await waitFor(() => expect(result.current.canSend).toBe(true));
    await act(async () => new Promise(resolve => setTimeout(resolve, 350)));
    expect(lightningApi.postPreparePayment).toHaveBeenCalledTimes(1);
    expect(result.current.fees?.idempotencyKey).toBe(idempotencyKey);
  });

  it('keeps an invalid send-all quote unsendable', async () => {
    vi.mocked(lightningApi.postPreparePayment).mockRejectedValue(new TSdkError(
      'insufficient funds', TLightningErrorCode.INSUFFICIENT_FUNDS,
    ));
    const { result } = renderPaymentReview();
    act(() => result.current.setSendAll(true));
    await waitFor(() => expect(result.current.preparedPayment?.status).toBe('error'));
    expect(result.current.canSend).toBe(false);
    await act(async () => result.current.sendPayment());
    expect(lightningApi.postSendPayment).not.toHaveBeenCalled();
  });
});
