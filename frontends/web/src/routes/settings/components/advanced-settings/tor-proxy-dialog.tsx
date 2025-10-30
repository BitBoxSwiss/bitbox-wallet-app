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
import { Dispatch, useEffect, useState } from 'react';
import { Dialog, DialogButtons } from '@/components/dialog/dialog';
import { Toggle } from '@/components/toggle/toggle';
import { Button, Input } from '@/components/forms';
import { setConfig } from '@/utils/config';
import { socksProxyCheck } from '@/api/backend';
import { alertUser } from '@/components/alert/Alert';
import { TConfig, TProxyConfig } from '@/routes/settings/advanced-settings';

type TProps = {
  open: boolean;
  proxyConfig?: TProxyConfig;
  onCloseDialog: () => void;
  onChangeConfig: (config: any) => void;
  handleShowRestartMessage: Dispatch<boolean>;
};

export const TorProxyDialog = ({ open, proxyConfig, onCloseDialog, onChangeConfig, handleShowRestartMessage }: TProps) => {
  const [proxyAddress, setProxyAddress] = useState<string>();
  const { t } = useTranslation();

  useEffect(() => {
    if (proxyConfig) {
      setProxyAddress(proxyConfig.proxyAddress);
    }
  }, [proxyConfig]);


  const handleSetProxyButton = async () => {
    if (!proxyConfig || proxyAddress === undefined) {
      return;
    }
    const proxy = proxyConfig;
    proxy.proxyAddress = proxyAddress.trim();

    const result = await socksProxyCheck(proxy.proxyAddress);
    const { success, errorMessage } = result;

    if (success) {
      await setProxyConfig(proxy);
    } else {
      alertUser(errorMessage || t('account.fatalError'));
    }
  };

  const setProxyConfig = async (proxyConfig: TProxyConfig) => {
    const config = await setConfig({
      backend: { proxy: proxyConfig },
    }) as TConfig;
    setProxyAddress(proxyConfig.proxyAddress);
    onChangeConfig(config);
    handleShowRestartMessage(true);
  };

  const handleToggleProxy = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!proxyConfig) {
      return;
    }
    const proxy = { ...proxyConfig, useProxy: e.target.checked };
    await setProxyConfig(proxy);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProxyAddress(e.target.value);
    handleShowRestartMessage(false);
  };

  // if no config nor proxyAddress
  if (!proxyConfig || proxyConfig === undefined || proxyAddress === undefined) {
    return null;
  }

  return (
    <Dialog open={open} onClose={onCloseDialog} title={t('settings.expert.setProxyAddress')} small>
      <div className="flex flex-row flex-between flex-items-center">
        <p className="m-none">{t('settings.expert.useProxy')}</p>
        <Toggle
          id="useProxy"
          checked={proxyConfig.useProxy}
          onChange={handleToggleProxy} />
      </div>
      <div className="m-top-half">
        <Input
          name="proxyAddress"
          onInput={handleInputChange}
          value={proxyAddress}
          placeholder="127.0.0.1:9050"
          disabled={!proxyConfig.useProxy}
        />
        <DialogButtons>
          <Button primary
            onClick={handleSetProxyButton}
            disabled={!proxyConfig.useProxy || proxyAddress === proxyConfig.proxyAddress}>
            {t('settings.expert.setProxyAddress')}
          </Button>
        </DialogButtons>
      </div>
    </Dialog>
  );
};