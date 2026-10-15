// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type TLightningPayment,
  type TReceivePaymentResponse,
  getListPayments,
  subscribeListPayments,
} from '@/api/lightning';
import { useMountedRef } from '@/hooks/mount';
import { unsubscribe } from '@/utils/subscriptions';

export type TReceiveStep = 'address' | 'create-invoice' | 'wait' | 'invoice' | 'success';

type TProps = {
  onSuccess: () => void;
  receivePaymentResponse?: TReceivePaymentResponse;
  step: TReceiveStep;
};

export const useReceivePaymentSuccess = ({
  onSuccess,
  receivePaymentResponse,
  step,
}: TProps) => {
  const mounted = useMountedRef();
  const hasLoadedPayments = useRef(false);
  const paymentStatuses = useRef<Map<TLightningPayment['id'], TLightningPayment['status']>>(new Map());
  const [payments, setPayments] = useState<TLightningPayment[]>();
  const [receivedPayment, setReceivedPayment] = useState<TLightningPayment>();

  const resetReceivedPayment = useCallback(() => {
    setReceivedPayment(undefined);
  }, []);

  const loadPayments = useCallback(() => {
    getListPayments()
      .then((payments) => {
        if (mounted.current) {
          setPayments(payments);
        }
      })
      .catch(console.error);
  }, [mounted]);

  // load the initial payment list, then reload it whenever the backend reports a payment change.
  useEffect(() => {
    loadPayments();
    const subscriptions = [subscribeListPayments(loadPayments)];
    return () => unsubscribe(subscriptions);
  }, [loadPayments]);

  // match paid invoices, or detect new payments to the lightning address after the first loaded payment list.
  useEffect(() => {
    if (!payments) {
      return;
    }

    const isInitialized = hasLoadedPayments.current;
    const previousStatuses = paymentStatuses.current;
    // store statuses before matching so old completed payments do not reopen the success screen.
    paymentStatuses.current = new Map(payments.map(payment => [payment.id, payment.status]));
    hasLoadedPayments.current = true;

    if (receivePaymentResponse && step === 'invoice') {
      // created invoices can be matched exactly by their invoice string.
      const payment = payments.find((payment) => payment.type === 'receive' && payment.invoice === receivePaymentResponse.invoice);
      if (payment?.status === 'complete') {
        setReceivedPayment(payment);
        onSuccess();
      }
      return;
    }

    if (!isInitialized || step !== 'address') {
      return;
    }

    const payment = payments.find((payment) => (
      payment.type === 'receive'
      && payment.status === 'complete'
      && previousStatuses.get(payment.id) !== 'complete'
    ));
    if (payment) {
      setReceivedPayment(payment);
      onSuccess();
    }
  }, [onSuccess, payments, receivePaymentResponse, step]);

  return {
    receivedPayment,
    resetReceivedPayment,
  };
};
