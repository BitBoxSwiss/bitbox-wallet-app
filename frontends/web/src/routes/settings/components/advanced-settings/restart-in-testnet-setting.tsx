// SPDX-License-Identifier: Apache-2.0

import { Dispatch, useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TConfig } from '@/routes/settings/advanced-settings';
import { AppContext } from '@/contexts/AppContext';
import { SettingsItem } from '@/routes/settings/components/settingsItem/settingsItem';
import { View, ViewButtons, ViewHeader } from '@/components/view/view';
import { Button } from '@/components/forms';
import { setConfig } from '@/utils/config';
import { UseBackButton } from '@/hooks/backbutton';

type TProps = {
  onChangeConfig: Dispatch<TConfig>;
};

export const RestartInTestnetSetting = ({ onChangeConfig }: TProps) => {
  const { t } = useTranslation();
  const [showRestartMessage, setShowRestartMessage] = useState(false);
  const { isTesting } = useContext(AppContext);

  const handleRestart = async () => {
    setShowRestartMessage(true);
    const config = await setConfig({
      backend: {
        startInTestnet: !isTesting
      },
    });
    onChangeConfig(config);
  };

  const handleReset = async () => {
    setShowRestartMessage(false);
    if (!isTesting) {
      const config = await setConfig({
        backend: {
          startInTestnet: false
        },
      });
      onChangeConfig(config);
    }
  };

  if (showRestartMessage) {
    return (
      <View fullscreen textCenter verticallyCentered>
        <UseBackButton handler={() => {
          handleReset();
          return false;
        }} />
        <ViewHeader title={
          isTesting
            ? t('testnet.deactivate.title')
            : t('testnet.activate.title')
        }>
          {isTesting
            ? t('testnet.deactivate.prompt')
            : t('testnet.activate.prompt')
          }
        </ViewHeader>
        <ViewButtons>
          <Button secondary onClick={handleReset}>
            {t('dialog.cancel')}
          </Button>
        </ViewButtons>
      </View>
    );
  }

  if (isTesting) {
    return (
      <SettingsItem
        settingName={t('testnet.deactivate.title')}
        secondaryText={t('testnet.deactivate.description')}
        onClick={handleRestart}
      />
    );
  }

  return (
    <SettingsItem
      settingName={t('testnet.activate.title')}
      secondaryText={t('testnet.activate.description')}
      onClick={handleRestart}
    />
  );
};
