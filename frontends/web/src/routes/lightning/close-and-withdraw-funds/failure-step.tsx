// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { Button } from '@/components/forms';
import { View, ViewButtons, ViewContent } from '@/components/view/view';
import { CONTENT_MIN_HEIGHT } from './constants';
import styles from './close-withdraw-funds.module.css';

type TProps = {
  onCancel: () => void;
  onTryAgain: () => void;
};

export const CloseWithdrawFailure = ({
  onCancel,
  onTryAgain,
}: TProps) => {
  const { t } = useTranslation();

  return (
    <View key="close-withdraw-funds-failure" minHeight={CONTENT_MIN_HEIGHT} textCenter width="min(420px, 100%)">
      <ViewContent withIcon="error">
        <div className={styles.failureContent}>
          <p className={styles.failureMessage}>{t('lightning.closeWithdrawFunds.failure.message')}</p>
          <p className={styles.failureNote}>{t('lightning.closeWithdrawFunds.failure.tryAgain')}</p>
        </div>
      </ViewContent>
      <ViewButtons>
        <Button className={styles.doneButton} primary onClick={onTryAgain}>
          {t('lightning.closeWithdrawFunds.failure.tryAgain')}
        </Button>
        <Button className={styles.doneButton} secondary onClick={onCancel}>
          {t('dialog.cancel')}
        </Button>
      </ViewButtons>
    </View>
  );
};
