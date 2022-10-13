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
import { Button, Input } from '../../components/forms';
import { apiPost } from '../../utils/request';
import { alertUser } from '../../components/alert/Alert';
import { TElectrumServer } from './types';
import style from './electrum.module.css';

type Props = {
  onAdd: (server: TElectrumServer) => void;
};

export const ElectrumAddServer = ({
  onAdd,
}: Props) => {
  const { t } = useTranslation();
  const [valid, setValid] = useState<boolean>();
  const [electrumServer, setElectrumServer] = useState<string>('');
  const [electrumCert, setElectrumCert] = useState<string>('');
  const [loadingCheck, setLoadingCheck] = useState<boolean>(false);
  const [loadingCert, setLoadingCert] = useState<boolean>(false);

  const getServer = (): TElectrumServer => {
    return {
      server: electrumServer.trim(),
      pemCert: electrumCert,
      tls: electrumCert !== '',
    };
  };

  const add = () => {
    onAdd(getServer());
    setElectrumServer('');
    setElectrumCert('');
  };

  const downloadCert = async () => {
    setLoadingCert(true);
    const data = await apiPost('certs/download', electrumServer.trim());
    if (data.success) {
      setElectrumCert(data.pemCert);
    } else {
      alertUser(data.errorMessage);
    }
    setLoadingCert(false);
  };

  const check = async () => {
    setLoadingCheck(true);
    const { success, errorMessage } = await apiPost('electrum/check', getServer());
    if (success) {
      alertUser(t('settings.electrum.checkSuccess', { host: electrumServer }));
    } else {
      alertUser(t('settings.electrum.checkFailed') + ':\n' + errorMessage);
    }
    setValid(success);
    setLoadingCheck(false);
  };
  return (
    <div className={style.addServer}>
      <div className="flex flex-row flex-start flex-wrap">
        <p className={style.badge}>{t('settings.electrum.step1')}</p>
        <div className="flex-1">
          <p>{t('settings.electrum.step1-text')}</p>
        </div>
      </div>
      <Input
        name="electrumServer"
        onInput={event => setElectrumServer(event.target.value)}
        value={electrumServer}
        placeholder="host:port"
      />
      <div className="flex flex-row flex-start flex-wrap">
        <p className={style.badge}>{t('settings.electrum.step2')}</p>
        <div className="flex-1">
          <p>{t('settings.electrum.step2-text')}</p>
          <p>{t('settings.electrum.step2-text-tcp')}</p>
        </div>
      </div>
      <textarea
        className={style.textarea}
        rows={10}
        cols={80}
        name="electrumCert"
        onInput={event => setElectrumCert((event.target as HTMLTextAreaElement).value)}
        value={electrumCert}
        placeholder={'-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----'}
      />
      <div className={[style.block, 'flex flex-row flex-end'].join(' ')}>
        <Button primary disabled={loadingCert || electrumCert !== ''} onClick={downloadCert}>
          {
            loadingCert && (
              <div className={style.miniSpinnerContainer}>
                <div className={style.miniSpinner}></div>
              </div>
            )
          }
          {t('settings.electrum.download-cert')}
        </Button>
      </div>
      <div className="flex flex-row flex-start flex-wrap">
        <p className={style.badge}>{t('settings.electrum.step3')}</p>
        <div className="flex-1">
          <p>{t('settings.electrum.step3-text')}</p>
        </div>
      </div>
      <div className={['flex flex-row flex-end spaced', style.block].join(' ')}>
        <Button primary disabled={electrumServer === '' || loadingCheck} onClick={check}>
          {
            loadingCheck && (
              <div className={style.miniSpinnerContainer}>
                <div className={style.miniSpinner}></div>
              </div>
            )
          }
          { loadingCheck ? t('settings.electrum.checking') : t('settings.electrum.check') }
        </Button>
        <Button primary disabled={!valid} onClick={add}>{t('settings.electrum.add-server')}</Button>
      </div>
      <div className="flex flex-row flex-start flex-wrap">
        <p className={style.badge}>{t('settings.electrum.step4')}</p>
        <div className="flex-1">
          <p>{t('settings.electrum.step4-text')}</p>
        </div>
      </div>
    </div>
  );
};
