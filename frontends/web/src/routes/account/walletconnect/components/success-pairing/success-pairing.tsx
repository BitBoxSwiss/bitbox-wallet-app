// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import * as accountAPI from '@/api/account';
import { Button } from '@/components/forms';
import { AnimatedChecked } from '@/components/icon';
import styles from './success-pairing.module.css';

type TProps = {
  accountCode: accountAPI.AccountCode;
};

export const WCSuccessPairing = ({ accountCode }: TProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  return (
    <div className={styles.container}>
      <AnimatedChecked className={styles.successIcon} />
      <p className={styles.successText}>{t('walletConnect.pairingSuccess')}</p>
      <Button primary onClick={() => navigate(`/account/${accountCode}/wallet-connect/dashboard`)}>
        {t('button.done')}
      </Button>
    </div>
  );
};
