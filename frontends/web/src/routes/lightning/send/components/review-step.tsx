// SPDX-License-Identifier: Apache-2.0

import { ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TPaymentInputTypeVariant, type TPaymentInputType, type TPreparePaymentResponse, postPreparePayment, postSendPayment, TSdkError } from '@/api/lightning';
import { Button, Input } from '@/components/forms';
import { Column, Grid } from '@/components/layout';
import { Spinner } from '@/components/spinner/Spinner';
import { Status } from '@/components/status/status';
import { View, ViewButtons, ViewContent } from '@/components/view/view';
import { useDebounce } from '@/hooks/debounce';
import { useMountedRef } from '@/hooks/mount';
import { PaymentAmountDetails, PaymentDetails, PaymentFeeDetails } from './invoice-details';
import { SendingSpinner } from './sending-spinner';

const isValidCustomAmount = (amount?: number) => (
  typeof amount === 'number'
  && Number.isFinite(amount)
  && Number.isInteger(amount)
  && amount > 0
);

type TProps = {
  paymentDetails?: TPaymentInputType;
  backToSelectInvoice: (nextInputError?: string) => void;
  onSuccess: () => void;
};

export const ReviewStep = ({
  paymentDetails,
  backToSelectInvoice,
  onSuccess,
}: TProps) => {
  const { t } = useTranslation();
  const mounted = useMountedRef();
  const customAmountRef = useRef<string>();
  const invoice = paymentDetails?.type === TPaymentInputTypeVariant.BOLT11 ? paymentDetails.invoice : undefined;
  const [customAmount, setCustomAmount] = useState<string>();
  const debouncedCustomAmount = useDebounce(customAmount, 300);
  const [fees, setFees] = useState<TPreparePaymentResponse>();
  const [preparedCustomAmount, setPreparedCustomAmount] = useState<string>();
  const [prepareError, setPrepareError] = useState<string>();
  const [isPreparing, setIsPreparing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string>();

  const toErrorMessage = useCallback((error: unknown): string => {
    if (error instanceof TSdkError) {
      if (error.code) {
        return t(`error.${error.code}`);
      }
      return error.message;
    }
    return String(error);
  }, [t]);

  const resetCustomAmountFees = useCallback(() => {
    setFees(undefined);
    setPreparedCustomAmount(undefined);
    setPrepareError(undefined);
    setIsPreparing(false);
  }, []);

  const startPreparingFees = useCallback((amountSat?: string) => {
    setIsPreparing(true);
    setFees(undefined);
    setPreparedCustomAmount(amountSat);
    setPrepareError(undefined);
  }, []);

  const applyPreparedFees = useCallback((
    nextFees: TPreparePaymentResponse,
    amountSat?: string,
  ) => {
    setFees(nextFees);
    setPreparedCustomAmount(amountSat);
    setPrepareError(undefined);
    setIsPreparing(false);
  }, []);

  const applyPrepareError = useCallback((errorMessage: string, amountSat: string) => {
    setFees(undefined);
    setPreparedCustomAmount(amountSat);
    setPrepareError(errorMessage);
    setIsPreparing(false);
    setSendError(undefined);
  }, []);

  const getActiveFees = useCallback((amountSat?: string) => (
    invoice?.amountSat === undefined
      ? preparedCustomAmount === amountSat ? fees : undefined
      : fees
  ), [fees, invoice?.amountSat, preparedCustomAmount]);

  const preparePayment = useCallback(async (amountSat?: string) => {
    if (!invoice) {
      return;
    }
    if (invoice.amountSat === undefined && !isValidCustomAmount(Number(amountSat))) {
      return;
    }
    const isCustomAmount = amountSat !== undefined;

    startPreparingFees(amountSat);

    try {
      const fees = await postPreparePayment({
        bolt11: invoice.bolt11,
        amountSat,
      });

      const discardFees = isCustomAmount && customAmountRef.current !== amountSat;
      if (!mounted.current || discardFees) {
        return;
      }

      applyPreparedFees(fees, amountSat);
    } catch (error) {
      const discardFees = isCustomAmount && customAmountRef.current !== amountSat;
      if (!mounted.current || discardFees) {
        return;
      }

      if (!isCustomAmount) {
        setIsPreparing(false);
        backToSelectInvoice(toErrorMessage(error));
        return;
      }

      applyPrepareError(toErrorMessage(error), amountSat);
    }
  }, [
    invoice,
    mounted,
    applyPrepareError,
    applyPreparedFees,
    backToSelectInvoice,
    startPreparingFees,
    toErrorMessage,
  ]);

  const retryPreparePayment = useCallback(async (errorMessage: string, amountSat?: string) => {
    setSendError(errorMessage);
    await preparePayment(amountSat);
  }, [preparePayment]);

  const sendPayment = useCallback(async () => {
    if (!invoice) {
      return;
    }
    const isAmountlessInvoice = invoice.amountSat === undefined;
    if (isAmountlessInvoice && !isValidCustomAmount(Number(customAmount))) {
      setSendError(t('send.error.invalidAmount'));
      return;
    }

    const activeFees = getActiveFees(customAmount);
    if (!activeFees) {
      return;
    }

    setIsSending(true);
    setSendError(undefined);

    try {
      await postSendPayment({
        bolt11: invoice.bolt11,
        amountSat: invoice.amountSat === undefined ? customAmount : undefined,
        approvedFeeSat: activeFees.feeSat,
      });
      onSuccess();
    } catch (error) {
      if (mounted.current) {
        setIsSending(false);
      }

      const errorMessage = toErrorMessage(error);
      if (error instanceof TSdkError && error.code === 'lightningInvoiceAlreadyUsed') {
        backToSelectInvoice(errorMessage);
        return;
      }
      if (
        error instanceof TSdkError
        && error.code === 'paymentApprovalRequired'
      ) {
        await retryPreparePayment(errorMessage, isAmountlessInvoice ? customAmount : undefined);
        return;
      }

      setSendError(errorMessage);
    }
  }, [
    customAmount,
    backToSelectInvoice,
    getActiveFees,
    mounted,
    onSuccess,
    invoice,
    retryPreparePayment,
    t,
    toErrorMessage,
  ]);

  // Reset all review-local state when a new invoice enters the review step.
  useEffect(() => {
    setCustomAmount(undefined);
    resetCustomAmountFees();
    setIsSending(false);
    setSendError(undefined);

    if (!invoice || invoice.amountSat === undefined) {
      return;
    }

    void preparePayment();
  }, [invoice, preparePayment, resetCustomAmountFees]);

  // Clear the current custom-amount fees whenever the typed amount changes.
  useEffect(() => {
    if (!invoice || invoice.amountSat !== undefined) {
      return;
    }

    customAmountRef.current = customAmount;
    setSendError(undefined);
    resetCustomAmountFees();
  }, [customAmount, invoice, resetCustomAmountFees]);

  // Prepare fees for the custom amount after the debounced amount settles on a valid value.
  useEffect(() => {
    if (!invoice || invoice.amountSat !== undefined) {
      return;
    }

    if (debouncedCustomAmount !== customAmount) {
      return;
    }

    void preparePayment(debouncedCustomAmount);
  }, [customAmount, debouncedCustomAmount, invoice, preparePayment]);


  if (!invoice || !paymentDetails || paymentDetails.type !== TPaymentInputTypeVariant.BOLT11) {
    return null;
  }

  if (isSending) {
    return <SendingSpinner />;
  }

  const isAmountlessInvoice = invoice.amountSat === undefined;
  const paymentFees = getActiveFees(customAmount);
  const canSend = !!paymentFees;
  const showCustomAmountFees = isPreparing || paymentFees;

  return (
    <View fitContent minHeight="100%">
      <ViewContent>
        <Grid col="1">
          <Column>
            <Status dismissibleKey="" type="warning" hidden={!sendError}>
              {sendError}
            </Status>
            {isAmountlessInvoice ? (
              <>
                <Input
                  type="number"
                  min="0"
                  label={t('lightning.receive.amountSats.label')}
                  placeholder={t('lightning.receive.amountSats.placeholder')}
                  id="amountSatsInput"
                  onInput={(event: ChangeEvent<HTMLInputElement>) => {
                    const amount = event.target.value;
                    setCustomAmount(Number.isNaN(Number(amount)) ? undefined : amount);
                  }}
                  value={customAmount ? `${customAmount}` : ''}
                  autoFocus
                />
                <Input
                  type="text"
                  label={t('lightning.receive.description.label')}
                  placeholder={t('lightning.receive.description.placeholder')}
                  id="descriptionInput"
                  readOnly
                  disabled
                  value={invoice.description || ''}
                />
                <Status dismissibleKey="" type="error" hidden={!prepareError}>
                  {prepareError}
                </Status>
                {showCustomAmountFees && (
                  <>
                    <PaymentAmountDetails amountSat={paymentFees?.amountSat} />
                    <PaymentFeeDetails fees={paymentFees} totalWithFiat />
                  </>
                )}
              </>
            ) : (
              paymentFees
                ? <PaymentDetails input={paymentDetails} fees={paymentFees} />
                : isPreparing && <Spinner text={t('loading')} />
            )}
          </Column>
        </Grid>
      </ViewContent>
      <ViewButtons>
        <Button
          primary
          onClick={sendPayment}
          disabled={!canSend}>
          {t('generic.send')}
        </Button>
        <Button secondary onClick={() => backToSelectInvoice()}>
          {t('button.back')}
        </Button>
      </ViewButtons>
    </View>
  );
};
