
/**
 * Copyright 2023 Shift Crypto AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { useTranslation } from 'react-i18next';
import { Button } from '../../../../../components/forms';
import { AnimatedChecked } from '../../../../../components/icon';
import { route } from '../../../../../utils/route';
import styles from './success-pairing.module.css';

type TProps = {
    accountCode: string;
}

export const WCSuccessPairing = ({ accountCode }: TProps) => {
  const { t } = useTranslation();
  return (
    <div className={styles.container}>
      <AnimatedChecked className={styles.successIcon} />
      <p className={styles.successText}>{t('walletConnect.pairingSuccess')}</p>
      <Button primary onClick={() => route(`/account/${accountCode}/wallet-connect/dashboard`)}>{t('button.done')}</Button>
    </div>
  );
};
