// SPDX-License-Identifier: Apache-2.0

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { TPaymentInputType, type TLightningLNURLPay } from '@/api/lightning';
import { DesktopBackButton } from '@/components/backbutton/backbutton';
import { Button } from '@/components/forms';
import { Column, Grid } from '@/components/layout';
import { Status } from '@/components/status/status';
import { View, ViewButtons, ViewContent } from '@/components/view/view';
import { LNURLPayRecipientDetails, PaymentFeeDetails } from './payment-input-details';
import { type TPaymentReviewDetails, usePaymentReview } from '../hooks/use-payment-review';
import { CustomPaymentAmount } from './custom-payment-amount';
import { SendingSpinner } from './sending-spinner';

type TProps = {
  lnurlPay: TLightningLNURLPay;
  backToPaymentInput: (nextInputError?: string) => void;
  onSendingChange: (isSending: boolean) => void;
  onSuccess: () => void;
};

export const LNURLPayReviewStep = ({
  lnurlPay,
  backToPaymentInput,
  onSendingChange,
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
    fees,
    isSending,
    preparedPayment,
    sendError,
    sendPayment,
    setCustomAmount,
    startNewLNURLPayment,
  } = usePaymentReview({
    paymentDetails,
    backToPaymentInput,
    onSendingChange,
    onSuccess,
  });

  if (isSending) {
    return <SendingSpinner />;
  }

  const prepareError = amountError || (preparedPayment?.status === 'error' ? preparedPayment.error : undefined);
  const paymentStatus = preparedPayment?.status;
  const startsNewPayment = paymentStatus === 'completed' || paymentStatus === 'failed';

  return (
    <View fitContent minHeight="100%">
      <ViewContent>
        <Grid col="1">
          <Column>
            <Status dismissibleKey="" type="warning" hidden={!sendError}>
              {sendError}
            </Status>
            <CustomPaymentAmount
              key={lnurlPay.input}
              minAmountSat={lnurlPay.minAmountSat}
              maxAmountSat={lnurlPay.maxAmountSat}
              onAmountChange={setCustomAmount}
            />
            <LNURLPayRecipientDetails lnurlPay={lnurlPay} />
            <Status dismissibleKey="" type="error" hidden={!prepareError}>
              {prepareError}
            </Status>
            {(preparedPayment?.status === 'preparing' || fees) && (
              <PaymentFeeDetails fees={fees} totalWithFiat />
            )}
          </Column>
        </Grid>
      </ViewContent>
      <ViewButtons>
        <Button
          primary
          onClick={startsNewPayment ? startNewLNURLPayment : sendPayment}
          disabled={paymentStatus === 'pending' || (!startsNewPayment && !canSend)}>
          {paymentStatus === 'completed'
            ? t('lightning.send.lnurlPay.sendAnother')
            : paymentStatus === 'failed'
              ? t('lightning.send.lnurlPay.tryAgain')
              : paymentStatus === 'pending'
                ? t('lightning.send.lnurlPay.waiting')
                : t('generic.send')}
        </Button>
        <DesktopBackButton onClick={() => backToPaymentInput()}>
          {t('button.back')}
        </DesktopBackButton>
      </ViewButtons>
    </View>
  );
};
