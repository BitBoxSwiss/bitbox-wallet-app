// SPDX-License-Identifier: Apache-2.0

import { type TFunction } from 'i18next';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TLightningErrorCode, TSdkError, toLightningErrorMessage } from '@/api/lightning-errors';
import {
  TPaymentInputType,
  type TLightningBitcoinPaymentInput,
  type TLightningBolt11Invoice,
  type TLightningLNURLPay,
  type TPaymentFee,
  type TPrepareLNURLPaymentResponse,
  type TPreparePaymentRequest,
  type TPreparePaymentResponse,
  type TSendPaymentRequest,
  getListPayments,
  postPreparePayment,
  postSendPayment,
  postStartNewLNURLPayment,
  subscribeListPayments,
} from '@/api/lightning';
import { useDebounce } from '@/hooks/debounce';
import { useMountedRef } from '@/hooks/mount';

type TPreparedPayment =
  | { status: 'preparing'; amountSat?: number }
  | {
    status: 'ready' | 'unknown';
    amountSat?: number;
    fees: TPaymentFee;
    idempotencyKey?: string;
  }
  | {
    status: 'pending' | 'completed' | 'failed';
    amountSat?: number;
    idempotencyKey: string;
  }
  | { status: 'error'; amountSat?: number; error: string; fees?: TPaymentFee };

type TPreparePaymentOptions = {
  idempotencyKey?: string;
  silent?: boolean;
};

const isPositiveInteger = (amount?: number): amount is number => (
  typeof amount === 'number' && Number.isFinite(amount) && Number.isInteger(amount) && amount > 0
);

const isLNURLPaymentPreparation = (
  response: TPreparePaymentResponse
): response is TPrepareLNURLPaymentResponse => 'status' in response;

const lnurlPaymentFee = (
  response: Extract<TPrepareLNURLPaymentResponse, { status: 'ready' | 'unknown' }>
): TPaymentFee => ({
  amountSat: response.amountSat,
  feeSat: response.feeSat,
  totalDebitSat: response.totalDebitSat,
});

export type TPaymentReviewDetails = {
  type: TPaymentInputType.BITCOIN_ADDRESS;
  details: TLightningBitcoinPaymentInput;
} | {
  type: TPaymentInputType.BOLT11;
  details: TLightningBolt11Invoice;
} | {
  type: TPaymentInputType.LNURL_PAY;
  details: TLightningLNURLPay;
};

type TUsePaymentReviewProps = {
  paymentDetails: TPaymentReviewDetails;
  backToPaymentInput: (nextInputError?: string) => void;
  onSendingChange: (isSending: boolean) => void;
  onSuccess: () => void;
};

const isValidAmount = (paymentDetails: TPaymentReviewDetails, amount?: number): amount is number => {
  if (!isPositiveInteger(amount)) {
    return false;
  }
  if (paymentDetails.type === TPaymentInputType.LNURL_PAY) {
    return amount >= paymentDetails.details.minAmountSat && amount <= paymentDetails.details.maxAmountSat;
  }
  return true;
};

const invalidAmountError = (paymentDetails: TPaymentReviewDetails, t: TFunction): string => {
  if (paymentDetails.type === TPaymentInputType.LNURL_PAY) {
    return t('lightning.send.lnurlPay.invalidAmount', {
      maxAmount: paymentDetails.details.maxAmountSat,
      minAmount: paymentDetails.details.minAmountSat,
    });
  }
  return t('send.error.invalidAmount');
};

const insufficientFundsFees = (error: unknown): TPaymentFee | undefined => {
  if (!(error instanceof TSdkError)
    || error.code !== TLightningErrorCode.INSUFFICIENT_FUNDS
    || !error.data
    || !('feeSat' in error.data)) {
    return undefined;
  }
  return error.data;
};

export const usePaymentReview = ({
  paymentDetails,
  backToPaymentInput,
  onSendingChange,
  onSuccess,
}: TUsePaymentReviewProps) => {
  const { t } = useTranslation();
  const fixedAmountSat = paymentDetails.type === TPaymentInputType.BOLT11
    || paymentDetails.type === TPaymentInputType.BITCOIN_ADDRESS
    ? paymentDetails.details.amountSat
    : undefined;
  const needsCustomAmount = fixedAmountSat === undefined;
  const mounted = useMountedRef();
  const prepareGenerationRef = useRef(0);
  const submittedAttemptKeyRef = useRef<string>();
  const [customAmount, setCustomAmount] = useState<number>();
  const debouncedCustomAmount = useDebounce(customAmount, 300);
  const [preparedPayment, setPreparedPayment] = useState<TPreparedPayment>();
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string>();
  const currentAmountSat = needsCustomAmount ? customAmount : fixedAmountSat;
  const amountError = needsCustomAmount && currentAmountSat !== undefined && !isValidAmount(paymentDetails, currentAmountSat)
    ? invalidAmountError(paymentDetails, t)
    : undefined;

  const preparePayment = useCallback(async (
    amountSat?: number,
    { idempotencyKey, silent = false }: TPreparePaymentOptions = {},
  ) => {
    let preparePaymentRequest: TPreparePaymentRequest;
    switch (paymentDetails.type) {
    case TPaymentInputType.BITCOIN_ADDRESS:
      if (!isValidAmount(paymentDetails, amountSat)) {
        return;
      }
      preparePaymentRequest = {
        type: TPaymentInputType.BITCOIN_ADDRESS,
        paymentInput: paymentDetails.details.address,
        amountSat,
        idempotencyKey,
      };
      break;
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

    const generation = ++prepareGenerationRef.current;
    if (!silent) {
      setPreparedPayment({
        status: 'preparing',
        amountSat,
      });
    }

    try {
      const response = await postPreparePayment(preparePaymentRequest);

      if (!mounted.current
        || generation !== prepareGenerationRef.current) {
        return;
      }

      if (!isLNURLPaymentPreparation(response)) {
        setPreparedPayment({
          status: 'ready',
          amountSat,
          fees: response,
        });
        return;
      }

      const matchesSubmittedAttempt = submittedAttemptKeyRef.current === response.idempotencyKey;
      if (matchesSubmittedAttempt
        && (response.status === 'pending'
          || response.status === 'completed'
          || response.status === 'failed')) {
        setIsSending(false);
        if (response.status !== 'pending') {
          submittedAttemptKeyRef.current = undefined;
        }
        if (response.status === 'completed') {
          onSuccess();
          return;
        }
      }

      if (response.status === 'ready' || response.status === 'unknown') {
        setPreparedPayment({
          status: response.status,
          amountSat,
          fees: lnurlPaymentFee(response),
          idempotencyKey: response.idempotencyKey,
        });
        return;
      }

      setPreparedPayment({
        status: response.status,
        amountSat,
        idempotencyKey: response.idempotencyKey,
      });
    } catch (error) {
      if (!mounted.current
        || generation !== prepareGenerationRef.current) {
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
        fees: insufficientFundsFees(error),
      });
    }
  }, [
    backToPaymentInput,
    mounted,
    needsCustomAmount,
    onSuccess,
    paymentDetails,
    t,
  ]);

  const fees = preparedPayment
    && (preparedPayment.status === 'ready'
      || preparedPayment.status === 'unknown'
      || preparedPayment.status === 'error')
    && (!needsCustomAmount || preparedPayment.amountSat === currentAmountSat)
    ? preparedPayment.fees
    : undefined;

  const sendPayment = useCallback(async () => {
    if (needsCustomAmount && !isValidAmount(paymentDetails, currentAmountSat)) {
      setSendError(invalidAmountError(paymentDetails, t));
      return;
    }
    if (currentAmountSat === undefined
      || (preparedPayment?.status !== 'ready' && preparedPayment?.status !== 'unknown')
      || !fees) {
      return;
    }

    setIsSending(true);
    setSendError(undefined);

    try {
      const sendPaymentRequest: TSendPaymentRequest = (() => {
        switch (paymentDetails.type) {
        case TPaymentInputType.BITCOIN_ADDRESS:
          if (fees.idempotencyKey === undefined) {
            throw new TSdkError('idempotency key missing', TLightningErrorCode.INVALID_PAYMENT_INPUT);
          }
          return {
            type: TPaymentInputType.BITCOIN_ADDRESS,
            paymentInput: paymentDetails.details.address,
            amountSat: currentAmountSat,
            approvedFeeSat: fees.feeSat,
            idempotencyKey: fees.idempotencyKey,
          };
        case TPaymentInputType.BOLT11:
          return {
            type: TPaymentInputType.BOLT11,
            paymentInput: paymentDetails.details.invoice,
            amountSat: paymentDetails.details.amountSat === undefined ? currentAmountSat : undefined,
            approvedFeeSat: fees.feeSat,
          };
        case TPaymentInputType.LNURL_PAY:
          if (!preparedPayment.idempotencyKey) {
            throw new TSdkError('idempotency key missing', TLightningErrorCode.INVALID_PAYMENT_INPUT);
          }
          submittedAttemptKeyRef.current = preparedPayment.idempotencyKey;
          return {
            type: TPaymentInputType.LNURL_PAY,
            paymentInput: paymentDetails.details.input,
            amountSat: currentAmountSat,
            approvedFeeSat: fees.feeSat,
            idempotencyKey: preparedPayment.idempotencyKey,
          };
        }
      })();
      const result = await postSendPayment(sendPaymentRequest);

      if (paymentDetails.type !== TPaymentInputType.LNURL_PAY
        || sendPaymentRequest.type !== TPaymentInputType.LNURL_PAY) {
        onSuccess();
        return;
      }
      if (!mounted.current
        || submittedAttemptKeyRef.current !== sendPaymentRequest.idempotencyKey) {
        return;
      }
      if (!result) {
        throw new TSdkError('payment result missing');
      }

      setIsSending(false);
      if (result.status === 'completed') {
        submittedAttemptKeyRef.current = undefined;
        onSuccess();
        return;
      }
      if (result.status === 'failed') {
        submittedAttemptKeyRef.current = undefined;
      }
      setPreparedPayment({
        status: result.status,
        amountSat: currentAmountSat,
        idempotencyKey: sendPaymentRequest.idempotencyKey,
      });
    } catch (error) {
      if (!mounted.current) {
        return;
      }

      setIsSending(false);
      const errorMessage = toLightningErrorMessage(t, error);

      if (error instanceof TSdkError
        && error.code === TLightningErrorCode.INVOICE_ALREADY_USED
        && paymentDetails.type !== TPaymentInputType.LNURL_PAY) {
        backToPaymentInput(errorMessage);
        return;
      }

      setSendError(errorMessage);
      const needsReprepare = paymentDetails.type === TPaymentInputType.LNURL_PAY
        || (error instanceof TSdkError && error.code === TLightningErrorCode.PAYMENT_APPROVAL_REQUIRED);
      if (!needsReprepare) {
        return;
      }
      // Fees and logical status may have changed while sending. LNURL retries also need to
      // reconcile an ambiguous SDK result before another action is enabled.
      const amountSat = paymentDetails.type === TPaymentInputType.BOLT11
        && paymentDetails.details.amountSat !== undefined
        ? undefined
        : currentAmountSat;
      await preparePayment(amountSat, {
        idempotencyKey: fees.idempotencyKey,
      });
    }
  }, [
    backToPaymentInput,
    fees,
    mounted,
    needsCustomAmount,
    onSuccess,
    currentAmountSat,
    paymentDetails,
    preparedPayment,
    preparePayment,
    t,
  ]);

  const startNewLNURLPayment = useCallback(async () => {
    if (paymentDetails.type !== TPaymentInputType.LNURL_PAY
      || !isValidAmount(paymentDetails, currentAmountSat)
      || (preparedPayment?.status !== 'completed' && preparedPayment?.status !== 'failed')) {
      return;
    }

    setIsSending(true);
    setSendError(undefined);
    submittedAttemptKeyRef.current = undefined;
    try {
      await postStartNewLNURLPayment({
        paymentInput: paymentDetails.details.input,
        amountSat: currentAmountSat,
        idempotencyKey: preparedPayment.idempotencyKey,
      });
      if (!mounted.current) {
        return;
      }
      await preparePayment(currentAmountSat);
    } catch (error) {
      if (!mounted.current) {
        return;
      }
      setSendError(toLightningErrorMessage(t, error));
      await preparePayment(currentAmountSat, { silent: true });
    } finally {
      if (mounted.current) {
        setIsSending(false);
      }
    }
  }, [currentAmountSat, mounted, paymentDetails, preparePayment, preparedPayment, t]);

  useEffect(() => {
    onSendingChange(isSending);
  }, [isSending, onSendingChange]);

  useEffect(() => {
    prepareGenerationRef.current += 1;
    submittedAttemptKeyRef.current = undefined;
    setCustomAmount(undefined);
    setPreparedPayment(undefined);
    setIsSending(false);
    setSendError(undefined);

    if (!needsCustomAmount) {
      preparePayment(paymentDetails.type === TPaymentInputType.BITCOIN_ADDRESS
        ? fixedAmountSat
        : undefined);
    }
  }, [fixedAmountSat, needsCustomAmount, paymentDetails, preparePayment]);

  useEffect(() => {
    if (!needsCustomAmount) {
      return;
    }

    prepareGenerationRef.current += 1;
    submittedAttemptKeyRef.current = undefined;
    setSendError(undefined);
    setPreparedPayment(undefined);
  }, [customAmount, needsCustomAmount, paymentDetails.type]);

  useEffect(() => {
    if (!needsCustomAmount || debouncedCustomAmount !== customAmount || customAmount === undefined) {
      return;
    }

    preparePayment(customAmount);
  }, [customAmount, debouncedCustomAmount, needsCustomAmount, preparePayment]);

  const currentIdempotencyKey = preparedPayment
    && preparedPayment.status !== 'preparing'
    && preparedPayment.status !== 'error'
    ? preparedPayment.idempotencyKey
    : undefined;

  useEffect(() => {
    if (paymentDetails.type !== TPaymentInputType.LNURL_PAY
      || currentAmountSat === undefined
      || !currentIdempotencyKey) {
      return;
    }

    const reconcilePayment = async () => {
      try {
        const payments = await getListPayments();
        if (payments.some(payment => payment.id === currentIdempotencyKey)) {
          await preparePayment(currentAmountSat, { silent: true });
        }
      } catch (error) {
        console.error(error);
      }
    };

    const unsubscribe = subscribeListPayments(reconcilePayment);
    reconcilePayment();
    return unsubscribe;
  }, [currentAmountSat, currentIdempotencyKey, paymentDetails.type, preparePayment]);

  return {
    canSend: (preparedPayment?.status === 'ready' || preparedPayment?.status === 'unknown') && !!fees,
    amountError,
    fees,
    isSending,
    preparedPayment,
    sendError,
    sendPayment,
    setCustomAmount,
    startNewLNURLPayment,
  };
};
