// SPDX-License-Identifier: Apache-2.0

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { t } = vi.hoisted(() => ({
  t: (key: string) => key,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t }),
}));
vi.mock('@/api/lightning');
vi.mock('@/hooks/debounce', () => ({
  useDebounce: <T>(value: T) => value,
}));

import * as lightningApi from '@/api/lightning';
import { usePaymentReview } from './use-payment-review';

const paymentDetails = {
  type: lightningApi.TPaymentInputType.LNURL_PAY,
  details: {
    input: 'alice@example.com',
    domain: 'example.com',
    minAmountSat: 1,
    maxAmountSat: 1_000,
  },
} as const;

const preparedPayment = (logicalPaymentStatus?: 'inFlight' | 'completed') => ({
  amountSat: 100,
  feeSat: 2,
  logicalPaymentStatus,
  totalDebitSat: 102,
});

const renderPaymentReview = () => {
  const backToPaymentInput = vi.fn();
  const onSuccess = vi.fn();
  return renderHook(() => usePaymentReview({
    paymentDetails,
    backToPaymentInput,
    onSuccess,
  }));
};

const enterAmount = async (result: ReturnType<typeof renderPaymentReview>['result']) => {
  act(() => result.current.setCustomAmount(100));
  await waitFor(() => expect(lightningApi.postPreparePayment).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(result.current.preparedPayment).toMatchObject({ status: 'ready' }));
};

describe('usePaymentReview LNURL payment intent', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('prepares a new intent instead of resending a completed payment', async () => {
    vi.mocked(lightningApi.postPreparePayment)
      .mockResolvedValueOnce(preparedPayment('completed'))
      .mockResolvedValueOnce(preparedPayment());
    const { result } = renderPaymentReview();

    await enterAmount(result);
    await act(async () => result.current.sendPayment());

    expect(lightningApi.postSendPayment).not.toHaveBeenCalled();
    expect(lightningApi.postPreparePayment).toHaveBeenLastCalledWith({
      type: lightningApi.TPaymentInputType.LNURL_PAY,
      paymentInput: 'alice@example.com',
      amountSat: 100,
      startNew: true,
    });
    expect(result.current.fees?.logicalPaymentStatus).toBeUndefined();
  });
});
