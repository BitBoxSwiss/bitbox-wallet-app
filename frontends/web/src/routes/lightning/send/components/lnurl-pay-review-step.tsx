// SPDX-License-Identifier: Apache-2.0

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { TPaymentInputType, type TLightningLNURLPay } from '@/api/lightning';
import { Button, Input } from '@/components/forms';
import { Column, Grid } from '@/components/layout';
import { Status } from '@/components/status/status';
import { View, ViewButtons, ViewContent } from '@/components/view/view';
import { LNURLPayRecipientDetails, PaymentAmountDetails, PaymentFeeDetails } from './payment-input-details';
import { type TPaymentReviewDetails, usePaymentReview } from '../hooks/use-payment-review';
import { SendingSpinner } from './sending-spinner';

type TProps = {
  lnurlPay: TLightningLNURLPay;
  backToPaymentInput: (nextInputError?: string) => void;
  onSuccess: () => void;
};

export const LNURLPayReviewStep = ({
  lnurlPay,
  backToPaymentInput,
  onSuccess,
}: TProps) => {
  const { t } = useTranslation();
  // Keep paymentDetails stable because usePaymentReview depends on this object in effects.
  const paymentDetails = useMemo<TPaymentReviewDetails>(() => ({
    type: TPaymentInputType.LNURL_PAY,
    details: lnurlPay,
  }), [lnurlPay]);
  const {
    amountError,
    canSend,
    customAmount,
    fees,
    isSending,
    preparedPayment,
    sendError,
    sendPayment,
    setCustomAmount,
  } = usePaymentReview({
    paymentDetails,
    backToPaymentInput,
    onSuccess,
  });

  if (isSending) {
    return <SendingSpinner />;
  }

  const prepareError = amountError || (preparedPayment?.status === 'error' ? preparedPayment.error : undefined);

  return (
    <View fitContent minHeight="100%">
      <ViewContent>
        <Grid col="1">
          <Column>
            <Status dismissibleKey="" type="warning" hidden={!sendError}>
              {sendError}
            </Status>
            <Input
              type="number"
              min={lnurlPay.minAmountSat}
              max={lnurlPay.maxAmountSat}
              label={t('lightning.receive.amountSats.label')}
              placeholder={t('lightning.receive.amountSats.placeholder')}
              id="amountSatsInput"
              onInput={(event) => {
                const amount = event.currentTarget.valueAsNumber;
                setCustomAmount(Number.isNaN(amount) ? undefined : amount);
              }}
              value={customAmount ?? ''}
              autoFocus
            />
            <LNURLPayRecipientDetails lnurlPay={lnurlPay} />
            <Status dismissibleKey="" type="error" hidden={!prepareError}>
              {prepareError}
            </Status>
            {(preparedPayment?.status === 'preparing' || fees) && (
              <>
                <PaymentAmountDetails amountSat={fees?.amountSat} />
                <PaymentFeeDetails fees={fees} totalWithFiat />
              </>
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
        <Button secondary onClick={() => backToPaymentInput()}>
          {t('button.back')}
        </Button>
      </ViewButtons>
    </View>
  );
};
