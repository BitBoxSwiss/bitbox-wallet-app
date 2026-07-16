// SPDX-License-Identifier: Apache-2.0

import { act } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TPaymentInputType, postPreparePayment, postSendPayment } from '@/api/lightning';
import { usePaymentReview } from './use-payment-review';

vi.mock('@/api/lightning', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/api/lightning')>();
  return {
    ...original,
    postPreparePayment: vi.fn(),
    postSendPayment: vi.fn(),
  };
});

vi.mock('react-i18next', () => {
  const t = (key: string) => key;
  return { useTranslation: () => ({ t }) };
});

vi.mock('@/hooks/debounce', () => ({
  useDebounce: <T, >(value: T): T => value,
}));

const postPreparePaymentMock = vi.mocked(postPreparePayment);
const postSendPaymentMock = vi.mocked(postSendPayment);

describe('usePaymentReview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prepares and sends a Bitcoin address payment', async () => {
    postPreparePaymentMock.mockResolvedValue({
      amountSat: 5_000,
      feeSat: 100,
      totalDebitSat: 5_100,
    });
    postSendPaymentMock.mockResolvedValue();
    const backToPaymentInput = vi.fn();
    const onSuccess = vi.fn();
    const paymentDetails = {
      type: TPaymentInputType.BITCOIN_ADDRESS,
      details: { address: 'bc1qdestination' },
    } as const;
    const { result } = renderHook(() => usePaymentReview({
      paymentDetails,
      backToPaymentInput,
      onSuccess,
    }));

    act(() => result.current.setCustomAmount(5_000));

    await waitFor(() => expect(postPreparePaymentMock).toHaveBeenCalledWith({
      type: TPaymentInputType.BITCOIN_ADDRESS,
      paymentInput: 'bc1qdestination',
      amountSat: 5_000,
    }));
    await waitFor(() => expect(result.current.canSend).toBe(true));

    await act(async () => result.current.sendPayment());

    expect(postSendPaymentMock).toHaveBeenCalledWith({
      type: TPaymentInputType.BITCOIN_ADDRESS,
      paymentInput: 'bc1qdestination',
      amountSat: 5_000,
      approvedFeeSat: 100,
    });
    expect(onSuccess).toHaveBeenCalledOnce();
  });
});
