// SPDX-License-Identifier: Apache-2.0

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { TPaymentInputType, type TLightningBitcoinAddress } from '@/api/lightning';
import { Button } from '@/components/forms';
import { Column, Grid } from '@/components/layout';
import { Status } from '@/components/status/status';
import { View, ViewButtons, ViewContent } from '@/components/view/view';
import { CustomPaymentAmount } from './custom-payment-amount';
import { BitcoinAddressRecipientDetails, PaymentAmountDetails, PaymentFeeDetails } from './payment-input-details';
import { SendingSpinner } from './sending-spinner';
import { type TPaymentReviewDetails, usePaymentReview } from '../hooks/use-payment-review';

type TProps = {
  bitcoinAddress: TLightningBitcoinAddress;
  backToPaymentInput: (nextInputError?: string) => void;
  onSuccess: () => void;
};

export const BitcoinAddressReviewStep = ({
  bitcoinAddress,
  backToPaymentInput,
  onSuccess,
}: TProps) => {
  const { t } = useTranslation();
  const needsCustomAmount = bitcoinAddress.amountSat === undefined;
  const paymentDetails = useMemo<TPaymentReviewDetails>(() => ({
    type: TPaymentInputType.BITCOIN_ADDRESS,
    details: bitcoinAddress,
  }), [bitcoinAddress]);
  const {
    amountError,
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

  const prepareError = amountError || (preparedPayment?.status === 'error' ? preparedPayment.error : undefined);

  return (
    <View fitContent minHeight="100%">
      <ViewContent>
        <Grid col="1">
          <Column>
            <Status dismissibleKey="" type="warning" hidden={!sendError}>
              {sendError}
            </Status>
            {needsCustomAmount ? (
              <CustomPaymentAmount
                key={bitcoinAddress.address}
                onAmountChange={setCustomAmount}>
                <BitcoinAddressRecipientDetails bitcoinAddress={bitcoinAddress} />
              </CustomPaymentAmount>
            ) : (
              <>
                <BitcoinAddressRecipientDetails bitcoinAddress={bitcoinAddress} />
                <PaymentAmountDetails amountSat={bitcoinAddress.amountSat} />
              </>
            )}
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
