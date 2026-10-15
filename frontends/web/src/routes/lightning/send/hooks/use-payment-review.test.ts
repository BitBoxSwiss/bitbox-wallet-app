// SPDX-License-Identifier: Apache-2.0

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as lightningApi from '@/api/lightning';
import { TLightningErrorCode, TSdkError } from '@/api/lightning-errors';
import { usePaymentReview } from './use-payment-review';

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
vi.mock('@/hooks/debounce', () => ({
  useDebounce: <T>(value: T) => value,
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
