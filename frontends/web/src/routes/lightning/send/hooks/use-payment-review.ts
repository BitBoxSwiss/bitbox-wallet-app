// SPDX-License-Identifier: Apache-2.0

import { type TFunction } from 'i18next';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TLightningErrorCode, TSdkError, toLightningErrorMessage } from '@/api/lightning-errors';
import { TPaymentInputType, type TLightningBolt11Invoice, type TLightningLNURLPay, type TPreparePaymentRequest, type TPreparePaymentResponse, type TSendPaymentRequest, postPreparePayment, postSendPayment } from '@/api/lightning';
import { useDebounce } from '@/hooks/debounce';
import { useMountedRef } from '@/hooks/mount';

type TPreparedPayment =
  | { status: 'preparing'; amountSat?: number }
  | { status: 'ready'; amountSat?: number; fees: TPreparePaymentResponse }
  | { status: 'error'; amountSat?: number; error: string };

const isPositiveInteger = (amount?: number): amount is number => (
  typeof amount === 'number' && Number.isFinite(amount) && Number.isInteger(amount) && amount > 0
);

export type TPaymentReviewDetails = {
  type: TPaymentInputType.BOLT11;
  details: TLightningBolt11Invoice;
} | {
  type: TPaymentInputType.LNURL_PAY;
  details: TLightningLNURLPay;
};

type TUsePaymentReviewProps = {
  paymentDetails: TPaymentReviewDetails;
  backToPaymentInput: (nextInputError?: string) => void;
  onSuccess: () => void;
};

const isValidAmount = (paymentDetails: TPaymentReviewDetails, amount?: number): amount is number => {
  if (!isPositiveInteger(amount)) {
    return false;
  }
  if (paymentDetails.type === TPaymentInputType.BOLT11) {
    return true;
  }
  return amount >= paymentDetails.details.minAmountSat && amount <= paymentDetails.details.maxAmountSat;
};

const invalidAmountError = (paymentDetails: TPaymentReviewDetails, t: TFunction): string => {
  if (paymentDetails.type === TPaymentInputType.BOLT11) {
    return t('send.error.invalidAmount');
  }
  return t('lightning.send.lnurlPay.invalidAmount', {
    maxAmount: paymentDetails.details.maxAmountSat,
    minAmount: paymentDetails.details.minAmountSat,
  });
};

export const usePaymentReview = ({
  paymentDetails,
  backToPaymentInput,
  onSuccess,
}: TUsePaymentReviewProps) => {
  const { t } = useTranslation();
  const fixedAmountSat = paymentDetails.type === TPaymentInputType.BOLT11
    ? paymentDetails.details.amountSat
    : undefined;
  const needsCustomAmount = fixedAmountSat === undefined;
  const mounted = useMountedRef();
  const customAmountRef = useRef<number>();
  const [customAmount, setCustomAmount] = useState<number>();
  const debouncedCustomAmount = useDebounce(customAmount, 300);
  const [preparedPayment, setPreparedPayment] = useState<TPreparedPayment>();
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string>();
  const currentAmountSat = needsCustomAmount ? customAmount : fixedAmountSat;
  const amountError = needsCustomAmount && currentAmountSat !== undefined && !isValidAmount(paymentDetails, currentAmountSat)
    ? invalidAmountError(paymentDetails, t)
    : undefined;

  const preparePayment = useCallback(async (amountSat?: number) => {
    let preparePaymentRequest: TPreparePaymentRequest;
    switch (paymentDetails.type) {
    case TPaymentInputType.BOLT11:
      if (needsCustomAmount && !isValidAmount(paymentDetails, amountSat)) {
        return;
      }
      preparePaymentRequest = {
        type: TPaymentInputType.BOLT11,
        paymentInput: paymentDetails.details.invoice,
        amountSat,
      };
      break;
    case TPaymentInputType.LNURL_PAY:
      if (!isValidAmount(paymentDetails, amountSat)) {
        return;
      }
      preparePaymentRequest = {
        type: TPaymentInputType.LNURL_PAY,
        paymentInput: paymentDetails.details.input,
        amountSat,
      };
      break;
    }

    setPreparedPayment({
      status: 'preparing',
      amountSat,
    });

    try {
      const fees = await postPreparePayment(preparePaymentRequest);

      if (!mounted.current || (needsCustomAmount && customAmountRef.current !== amountSat)) {
        return;
      }

      setPreparedPayment({
        status: 'ready',
        amountSat,
        fees,
      });
    } catch (error) {
      if (!mounted.current || (needsCustomAmount && customAmountRef.current !== amountSat)) {
        return;
      }

      if (!needsCustomAmount) {
        setPreparedPayment(undefined);
        backToPaymentInput(toLightningErrorMessage(t, error));
        return;
      }

      setPreparedPayment({
        status: 'error',
        amountSat,
        error: toLightningErrorMessage(t, error),
      });
      setSendError(undefined);
    }
  }, [
    backToPaymentInput,
    mounted,
    needsCustomAmount,
    paymentDetails,
    t,
  ]);

  const fees = preparedPayment?.status === 'ready'
    && (!needsCustomAmount || preparedPayment.amountSat === currentAmountSat)
    ? preparedPayment.fees
    : undefined;

  const sendPayment = useCallback(async () => {
    if (needsCustomAmount && !isValidAmount(paymentDetails, currentAmountSat)) {
      setSendError(invalidAmountError(paymentDetails, t));
      return;
    }

    if (currentAmountSat === undefined) {
      return;
    }

    if (!fees) {
      return;
    }

    setIsSending(true);
    setSendError(undefined);

    try {
      const sendPaymentRequest: TSendPaymentRequest = (() => {
        switch (paymentDetails.type) {
        case TPaymentInputType.BOLT11:
          return {
            type: TPaymentInputType.BOLT11,
            paymentInput: paymentDetails.details.invoice,
            amountSat: paymentDetails.details.amountSat === undefined ? currentAmountSat : undefined,
            approvedFeeSat: fees.feeSat,
          };
        case TPaymentInputType.LNURL_PAY:
          return {
            type: TPaymentInputType.LNURL_PAY,
            paymentInput: paymentDetails.details.input,
            amountSat: currentAmountSat,
            approvedFeeSat: fees.feeSat,
          };
        }
      })();
      await postSendPayment(sendPaymentRequest);
      onSuccess();
    } catch (error) {
      if (!mounted.current) {
        return;
      }

      setIsSending(false);
      const errorMessage = toLightningErrorMessage(t, error);

      if (error instanceof TSdkError && error.code === TLightningErrorCode.INVOICE_ALREADY_USED) {
        backToPaymentInput(errorMessage);
        return;
      }
      // It is possible that the fee retrieved during the prepare phase is no longer valid and that we need to re-prepare.
      if (error instanceof TSdkError && error.code === TLightningErrorCode.PAYMENT_APPROVAL_REQUIRED) {
        setSendError(errorMessage);
        // Fixed-amount BOLT11 invoices already encode the amount; pass amountSat only when the user entered it.
        const amountSat = paymentDetails.type === TPaymentInputType.BOLT11 && paymentDetails.details.amountSat !== undefined
          ? undefined
          : currentAmountSat;
        await preparePayment(amountSat);
        return;
      }

      setSendError(errorMessage);
    }
  }, [
    backToPaymentInput,
    fees,
    mounted,
    needsCustomAmount,
    onSuccess,
    currentAmountSat,
    paymentDetails,
    preparePayment,
    t,
  ]);

  useEffect(() => {
    setCustomAmount(undefined);
    setPreparedPayment(undefined);
    setIsSending(false);
    setSendError(undefined);

    if (!needsCustomAmount) {
      preparePayment();
    }
  }, [fixedAmountSat, needsCustomAmount, paymentDetails, preparePayment]);

  useEffect(() => {
    if (!needsCustomAmount) {
      return;
    }

    customAmountRef.current = customAmount;
    setSendError(undefined);
    setPreparedPayment(undefined);
  }, [customAmount, needsCustomAmount]);

  useEffect(() => {
    if (!needsCustomAmount || debouncedCustomAmount !== customAmount || customAmount === undefined) {
      return;
    }

    preparePayment(customAmount);
  }, [customAmount, debouncedCustomAmount, needsCustomAmount, preparePayment]);

  return {
    canSend: !!fees,
    customAmount,
    amountError,
    fees,
    isSending,
    preparedPayment,
    sendError,
    sendPayment,
    setCustomAmount,
  };
};
