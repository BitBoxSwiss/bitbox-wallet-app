// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { Dispatch, useEffect, useState } from 'react';
import { useMediaQuery } from '@/hooks/mediaquery';
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
  const isMobile = useMediaQuery('(max-width: 768px)');

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
          autoFocus={!isMobile}
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