// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/forms';
import { Column, Grid } from '@/components/layout';
import { View, ViewButtons, ViewContent } from '@/components/view/view';
import { useLightningSendContext } from '../lightning-send-context';
import { PaymentDetails } from './invoice-details';

export const ConfirmStep = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { paymentDetails, sendPayment } = useLightningSendContext();

  if (!paymentDetails) {
    return null;
  }

  return (
    <View fitContent minHeight="100%">
      <ViewContent>
        <Grid col="1">
          <Column>
            <PaymentDetails input={paymentDetails} />
          </Column>
        </Grid>
      </ViewContent>
      <ViewButtons>
        <Button primary onClick={sendPayment}>
          {t('generic.send')}
        </Button>
        <Button secondary onClick={() => navigate('/lightning')}>
          {t('button.back')}
        </Button>
      </ViewButtons>
    </View>
  );
};
