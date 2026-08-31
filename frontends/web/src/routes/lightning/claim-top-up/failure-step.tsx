// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { BackButton } from '@/components/backbutton/backbutton';
import { Button } from '@/components/forms';
import { View, ViewButtons, ViewContent } from '@/components/view/view';
import { CONTENT_MIN_HEIGHT, type TAction } from './constants';
import styles from './claim-top-up.module.css';

type TProps = {
  action: TAction;
  errorMessage?: string;
  onDone: () => void;
  onRefund?: () => void;
};

export const ClaimTopUpFailure = ({
  action,
  errorMessage,
  onDone,
  onRefund,
}: TProps) => {
  const { t } = useTranslation();
  const canTryRefund = action === 'claim' && !!onRefund;
  const messageKey = (
    action === 'claim'
      ? 'lightning.claimTopUp.failure.claimFailedMessage'
      : 'lightning.claimTopUp.failure.refundFailedMessage'
  );
  const note = (
    canTryRefund
      ? t('lightning.claimTopUp.failure.claimFailedTryRefund')
      : errorMessage || t('lightning.claimTopUp.failure.refundFailedTryAgain')
  );

  return (
    <View key="claim-top-up-failure" minHeight={CONTENT_MIN_HEIGHT} textCenter>
      <ViewContent withIcon="error">
        <div className={styles.successContent}>
          <p className={styles.successMessage}>{t(messageKey)}</p>
          <p className={styles.successNote}>{note}</p>
        </div>
      </ViewContent>
      <ViewButtons>
        <Button className={styles.doneButton} primary onClick={canTryRefund ? onRefund : onDone}>
          {canTryRefund
            ? t('lightning.claimTopUp.refundButton')
            : t('button.done')}
        </Button>
        {canTryRefund && (
          <BackButton className={styles.doneButton} onClick={onDone}>
            {t('dialog.cancel')}
          </BackButton>
        )}
      </ViewButtons>
    </View>
  );
};
