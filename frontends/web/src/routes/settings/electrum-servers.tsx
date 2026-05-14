// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import type { TBtcCoinConfigKey } from '@/api/config';
import type { TElectrumServer } from '@/api/node';
import { ElectrumAddServer } from './electrum-add-server';
import { ElectrumServer } from './electrum-server';
import { getDefaultConfig } from '@/api/backend';
import { useConfig } from '@/contexts/ConfigProvider';
import { confirmation } from '@/components/confirm/Confirm';
import { Button } from '@/components/forms';
import style from './electrum.module.css';

type Props = {
  coin: TBtcCoinConfigKey;
};

export const ElectrumServers = ({
  coin
}: Props) => {
  const { t } = useTranslation();
  const { config, setConfig } = useConfig();

  if (config === undefined) {
    return null;
  }
  const electrumServers: TElectrumServer[] = config.backend[coin].electrumServers;

  const save = async (newElectrumServers: TElectrumServer[]) => {
    await setConfig({
      backend: {
        [coin]: {
          ...config.backend[coin],
          electrumServers: newElectrumServers
        }
      }
    });
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
        <div className="flex flex-row flex-between flex-items-center">
          <h4 className="subTitle">{t('settings.electrum.servers')}</h4>
          <Button
            transparent
            className={style.resetLink}
            onClick={resetToDefault}>
            {t('settings.electrum.reset')}
          </Button>
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
