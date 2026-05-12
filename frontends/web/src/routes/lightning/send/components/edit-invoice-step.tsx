// SPDX-License-Identifier: Apache-2.0

import { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { TPaymentInputTypeVariant } from '@/api/lightning';
import { Button, Input } from '@/components/forms';
import { Column, Grid } from '@/components/layout';
import { View, ViewButtons, ViewContent } from '@/components/view/view';
import { useLightningSendContext } from '../lightning-send-context';

export const EditInvoiceStep = () => {
  const { t } = useTranslation();
  const {
    customAmount,
    paymentDetails,
    preparePayment,
    resetPayment,
    setCustomAmount,
  } = useLightningSendContext();

  if (paymentDetails?.type !== TPaymentInputTypeVariant.BOLT11) {
    return null;
  }

  return (
    <View fitContent minHeight="100%">
      <ViewContent>
        <Grid col="1">
          <Column>
            <Input
              type="number"
              min="0"
              label={t('lightning.receive.amountSats.label')}
              placeholder={t('lightning.receive.amountSats.placeholder')}
              id="amountSatsInput"
              onInput={(event: ChangeEvent<HTMLInputElement>) => setCustomAmount(event.target.valueAsNumber)}
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
              value={paymentDetails.invoice.description || ''}
            />
          </Column>
        </Grid>
      </ViewContent>
      <ViewButtons>
        <Button
          primary
          onClick={preparePayment}
          disabled={!customAmount}>
          {t('button.continue')}
        </Button>
        <Button secondary onClick={resetPayment}>
          {t('button.back')}
        </Button>
      </ViewButtons>
    </View>
  );
};
