// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { useMemo } from 'react';
import { TPaymentInputType, type TLightningBolt11Invoice } from '@/api/lightning';
import { Button } from '@/components/forms';
import { Column, Grid } from '@/components/layout';
import { Spinner } from '@/components/spinner/Spinner';
import { Status } from '@/components/status/status';
import { View, ViewButtons, ViewContent } from '@/components/view/view';
import { Bolt11PaymentDetails, PaymentFeeDetails, PaymentNoteDetails } from './payment-input-details';
import { type TPaymentReviewDetails, usePaymentReview } from '../hooks/use-payment-review';
import { CustomPaymentAmount, PaymentBalance } from './custom-payment-amount';
import { SendingSpinner } from './sending-spinner';

type TProps = {
  invoice: TLightningBolt11Invoice;
  backToPaymentInput: (nextInputError?: string) => void;
  onSuccess: () => void;
};

export const Bolt11ReviewStep = ({
  invoice,
  backToPaymentInput,
  onSuccess,
}: TProps) => {
  const { t } = useTranslation();
  const needsCustomAmount = invoice.amountSat === undefined;
  // Keep paymentDetails stable because usePaymentReview depends on this object in effects.
  const paymentDetails = useMemo<TPaymentReviewDetails>(() => ({
    type: TPaymentInputType.BOLT11,
    details: invoice,
  }), [invoice]);
  const {
    canSend,
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

  return (
    <View fitContent minHeight="100%">
      <ViewContent>
        <Grid col="1">
          <Column>
            <Status dismissibleKey="" type="warning" hidden={!sendError}>
              {sendError}
            </Status>
            {needsCustomAmount ? (
              <>
                <CustomPaymentAmount
                  key={invoice.invoice}
                  onAmountChange={setCustomAmount}
                />
                <PaymentNoteDetails description={invoice.description} />
                <Status dismissibleKey="" type="error" hidden={preparedPayment?.status !== 'error'}>
                  {preparedPayment?.status === 'error' ? preparedPayment.error : undefined}
                </Status>
                {(preparedPayment?.status === 'preparing' || fees) && (
                  <PaymentFeeDetails fees={fees} totalWithFiat />
                )}
              </>
            ) : (
              <>
                <PaymentBalance />
                {fees
                  ? <Bolt11PaymentDetails description={invoice.description} fees={fees} />
                  : preparedPayment?.status === 'preparing' && <Spinner text={t('loading')} />}
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
