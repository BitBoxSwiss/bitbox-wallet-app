
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

import { SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input } from '../../../../../components/forms';
import { route } from '../../../../../utils/route';
import styles from './connect-form.module.css';

type TWCConnectFormProps = {
    code: string;
    uri: string;
    onInputChange: (value: SetStateAction<string>) => void;
    onSubmit: (uri: string) => void;
}

export const WCConnectForm = ({ code, uri, onInputChange, onSubmit }: TWCConnectFormProps) => {
  const { t } = useTranslation();
  return (
    <div className={styles.formContainer}>
      <form onSubmit={(e) => {
        e.preventDefault();
        onSubmit(uri);
      }}>
        <p className={styles.label}>{t('walletConnect.connect.dappLabel')}</p>
        <Input
          value={uri}
          onInput={(e) => onInputChange(e.target.value)}>
        </Input>

        <div className={styles.formButtonsContainer}>
          <Button
            secondary
            onClick={() => route(`/account/${code}/wallet-connect/dashboard`)}>
            {t('dialog.cancel')}
          </Button>
          <Button
            type="submit"
            primary
          >
            {t('walletConnect.connect.button')}
          </Button>
        </div>
      </form>
    </div>
  );
};
