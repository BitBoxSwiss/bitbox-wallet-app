// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { Button } from '@/components/forms';
import { ExternalLink } from '@/components/icon';
import { View, ViewButtons, ViewContent } from '@/components/view/view';
import { CONTENT_MIN_HEIGHT } from './constants';
import styles from './close-withdraw-funds.module.css';

type TProps = {
  onDone: () => void;
};

const noop = () => undefined;

export const CloseWithdrawSuccess = ({
  onDone,
}: TProps) => {
  const { t } = useTranslation();

  return (
    <View key="close-withdraw-funds-success" minHeight={CONTENT_MIN_HEIGHT} textCenter width="min(420px, 100%)">
      <ViewContent withIcon="success">
        <div className={styles.successContent}>
          <p className={styles.successMessage}>{t('lightning.closeWithdrawFunds.success.message')}</p>
          <p className={styles.successNote}>{t('lightning.closeWithdrawFunds.success.note')}</p>
          <Button className={styles.transactionButton} transparent onClick={noop}>
            <ExternalLink className={styles.transactionIcon} />
            {t('lightning.closeWithdrawFunds.viewTransaction')}
          </Button>
        </div>
      </ViewContent>
      <ViewButtons>
        <Button className={styles.doneButton} primary onClick={onDone}>
          {t('button.done')}
        </Button>
      </ViewButtons>
    </View>
  );
};
