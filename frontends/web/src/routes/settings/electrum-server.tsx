/**
 * Copyright 2022 Shift Crypto AG
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

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TElectrumServer, checkElectrum } from '@/api/node';
import { alertUser } from '@/components/alert/Alert';
import style from './electrum.module.css';

type Props = {
  server: TElectrumServer;
  onRemove: () => void;
};

export const ElectrumServer = ({ onRemove, server }: Props) => {
  const { t } = useTranslation();
  const [loadingCheck, setLoadingCheck] = useState<boolean>(false);

  const check = async () => {
    setLoadingCheck(true);
    const response = await checkElectrum({
      server: server.server.trim(),
      pemCert: server.pemCert,
      tls: server.tls,
    });
    if (response.success) {
      alertUser(t('settings.electrum.checkSuccess', { host: server.server }));
    } else {
      alertUser(
        t('settings.electrum.checkFailed') + ':\n' + response.errorMessage,
      );
    }
    setLoadingCheck(false);
  };
  const buttonDisabled: boolean | undefined =
    server.server === '' ||
    (server.tls && server.pemCert === '') ||
    loadingCheck;
  return (
    <li>
      <div className={style.server}>
        <div className={style.serverLabel}>
          {server.server} <strong>{server.tls ? 'TLS' : 'TCP'}</strong>
        </div>
        <div>
          <button
            className={style.primary}
            disabled={buttonDisabled}
            onClick={check}
          >
            {loadingCheck && (
              <div className={style.miniSpinnerContainer}>
                <div className={style.miniSpinner}></div>
              </div>
            )}
            {loadingCheck
              ? t('settings.electrum.checking')
              : t('settings.electrum.check')}
          </button>
          <button className={style.warning} onClick={onRemove}>
            {t('settings.electrum.remove-server')}
          </button>
        </div>
      </div>
    </li>
  );
};
