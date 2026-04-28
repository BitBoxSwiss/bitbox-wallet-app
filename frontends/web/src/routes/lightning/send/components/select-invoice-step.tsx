// SPDX-License-Identifier: Apache-2.0

import { ChangeEvent, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Button, Input } from '@/components/forms';
import { Column, Grid } from '@/components/layout';
import { Status } from '@/components/status/status';
import { View, ViewButtons, ViewContent, ViewHeader } from '@/components/view/view';
import { ScanQRVideo } from '@/routes/account/send/components/inputs/scan-qr-video';
import { runningInAndroid, runningInIOS } from '@/utils/env';
import { useLightningSendContext } from '../lightning-send-context';
import styles from '../send.module.css';

export const SelectInvoiceStep = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { inputError, parsePaymentInput } = useLightningSendContext();
  const [invoiceInput, setInvoiceInput] = useState('');

  const scanQRVideo = useMemo(() => (
    <ScanQRVideo onResult={parsePaymentInput} />
  ), [parsePaymentInput]);

  const submitInvoiceInput = async () => {
    const success = await parsePaymentInput(invoiceInput);
    if (success) {
      setInvoiceInput('');
    }
  };

  return (
    <View textCenter width="660px">
      <ViewHeader title={t('lightning.send.qrCode.label')} />
      <ViewContent textAlign="center">
        <Grid col="1">
          <Column className={styles.camera}>
            <div className={styles.error}>
              {inputError && <Status dismissible="" type="warning">{inputError}</Status>}
            </div>
            {scanQRVideo}
            <Input
              placeholder={t('lightning.send.invoice.input')}
              onInput={(event: ChangeEvent<HTMLInputElement>) => setInvoiceInput(event.target.value)}
              value={invoiceInput}
              autoFocus={!runningInAndroid() && !runningInIOS()}
            />
          </Column>
        </Grid>
      </ViewContent>
      <ViewButtons>
        <Button disabled={!invoiceInput} primary onClick={submitInvoiceInput}>
          {t('generic.send')}
        </Button>
        <Button secondary onClick={() => navigate('/lightning')}>
          {t('button.back')}
        </Button>
      </ViewButtons>
    </View>
  );
};
