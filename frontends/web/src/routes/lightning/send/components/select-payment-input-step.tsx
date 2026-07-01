// SPDX-License-Identifier: Apache-2.0

import { ChangeEvent, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input } from '@/components/forms';
import { Column, Grid } from '@/components/layout';
import { Status } from '@/components/status/status';
import { View, ViewButtons, ViewContent, ViewHeader } from '@/components/view/view';
import { ScanQRVideo } from '@/routes/account/send/components/inputs/scan-qr-video';
import { runningInAndroid, runningInIOS } from '@/utils/env';
import styles from '../send.module.css';

type TProps = {
  inputError?: string;
  onCancel: () => void;
  onSubmit: (input: string) => Promise<boolean>;
};

export const SelectPaymentInputStep = ({
  inputError,
  onCancel,
  onSubmit,
}: TProps) => {
  const { t } = useTranslation();
  const [paymentInput, setPaymentInput] = useState('');

  const scanQRVideo = useMemo(() => (
    <ScanQRVideo onResult={(result: string) => void onSubmit(result)} />
  ), [onSubmit]);

  const submitPaymentInput = async () => {
    const success = await onSubmit(paymentInput);
    if (success) {
      setPaymentInput('');
    }
  };

  return (
    <View textCenter width="660px">
      <ViewHeader title={t('lightning.send.qrCode.label')} />
      <ViewContent textAlign="center">
        <Grid col="1">
          <Column className={styles.camera}>
            <div className={styles.error}>
              {inputError && <Status dismissibleKey="" type="warning">{inputError}</Status>}
            </div>
            {scanQRVideo}
            <Input
              placeholder={t('lightning.send.invoice.input')}
              onInput={(event: ChangeEvent<HTMLInputElement>) => setPaymentInput(event.target.value)}
              value={paymentInput}
              autoFocus={!runningInAndroid() && !runningInIOS()}
            />
          </Column>
        </Grid>
      </ViewContent>
      <ViewButtons>
        <Button disabled={!paymentInput} primary onClick={submitPaymentInput}>
          {t('generic.send')}
        </Button>
        <Button secondary onClick={onCancel}>
          {t('button.back')}
        </Button>
      </ViewButtons>
    </View>
  );
};
