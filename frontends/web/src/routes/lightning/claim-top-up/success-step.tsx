// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import type { TTopUpRecoveryResult } from '@/api/lightning';
import { A } from '@/components/anchor/anchor';
import { Button } from '@/components/forms';
import { ExternalLink } from '@/components/icon';
import { View, ViewButtons, ViewContent } from '@/components/view/view';
import { CONTENT_MIN_HEIGHT, type TAction } from './constants';
import styles from './claim-top-up.module.css';

type TProps = {
  action: TAction;
  claimOutcome?: TTopUpRecoveryResult['claimOutcome'];
  explorerURL?: string;
  onDone: () => void;
};

export const ClaimTopUpSuccess = ({
  action,
  claimOutcome = 'settled',
  explorerURL,
  onDone,
}: TProps) => {
  const { t } = useTranslation();

  return (
    <View key="claim-top-up-success" minHeight={CONTENT_MIN_HEIGHT} textCenter>
      <ViewContent withIcon="success">
        <div className={styles.successContent}>
          <p className={styles.successMessage}>
            {action === 'claim'
              ? t(`lightning.claimTopUp.success.${claimOutcome}Message`)
              : t('lightning.claimTopUp.success.refundMessage')}
          </p>
          <p className={styles.successNote}>
            {action === 'claim'
              ? t(`lightning.claimTopUp.success.${claimOutcome}Note`)
              : t('lightning.claimTopUp.success.refundNote')}
          </p>
          {explorerURL && (
            <A className={styles.transactionButton} href={explorerURL}>
              <ExternalLink className={styles.transactionIcon} />
              {t('lightning.claimTopUp.viewTransaction')}
            </A>
          )}
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
