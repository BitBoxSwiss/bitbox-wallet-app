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

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ElectrumAddServer } from './electrum-add-server';
import { ElectrumServer } from './electrum-server';
import { TElectrumServer } from './types';
import { getDefaultConfig } from '../../api/backend';
import { getConfig, setConfig } from '../../utils/config';
import { confirmation } from '../../components/confirm/Confirm';
import { A } from '../../components/anchor/anchor';
import style from './electrum.module.css';

type Props = {
  coin: 'btc' | 'tbtc' | 'ltc' | 'tltc';
};

export const ElectrumServers = ({
  coin
}: Props) => {
  const { t } = useTranslation();
  const [config, setConfigState] = useState<any>();
  const loadConfig = () => {
    getConfig().then(setConfigState);
  };
  useEffect(loadConfig, []);
  if (config === undefined) {
    return null;
  }
  const electrumServers: TElectrumServer[] = config.backend[coin].electrumServers;

  const save = async (newElectrumServers: TElectrumServer[]) => {
    const currentConfig = await getConfig();
    currentConfig.backend[coin].electrumServers = newElectrumServers;
    await setConfig(currentConfig);
    setConfigState(currentConfig);
  };

  const onAdd = (server: TElectrumServer) => {
    let newElectrumServers = [...electrumServers, server];
    save(newElectrumServers);
  };

  const onRemove = (index: number) => {
    let newElectrumServers = [...electrumServers];
    newElectrumServers.splice(index, 1);
    save(newElectrumServers);
  };

  const resetToDefault = () => {
    confirmation(t('settings.electrum.resetConfirm'), response => {
      if (response) {
        getDefaultConfig().then(config => {
          save(config.backend[coin].electrumServers);
        });
      }
    });
  };

  const onRemoveCb = (server: TElectrumServer, index: number) => (() => {
    confirmation(t('settings.electrum.removeConfirm', { server: server.server }), confirmed => {
      if (confirmed) {
        onRemove(index);
      }
    });
  });

  return (
    <div className={style.serversContainer}>
      <div className="row">
        <div className={['flex flex-row flex-between flex-items-center', style.titleContainer].join(' ')}>
          <h4 className="subTitle m-none">{t('settings.electrum.servers')}</h4>
          <A href="#" className={['labelLarge labelLink', style.resetLink].join(' ')} onClick={resetToDefault}>{t('settings.electrum.reset')}</A>
        </div>
        <ul className={style.servers}>
          {
            electrumServers.map((server, index) => (
              <ElectrumServer
                key={server.server + server.tls.toString() + '-' + index.toString()}
                server={server}
                onRemove={onRemoveCb(server, index)}
              />
            ))
          }
        </ul>
      </div>
      <hr />
      <div className="row">
        <h4 className="subTitle">{t('settings.electrum.add')}</h4>
        <ElectrumAddServer onAdd={onAdd} />
      </div>
    </div>
  );
};
