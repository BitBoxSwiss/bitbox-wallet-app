// SPDX-License-Identifier: Apache-2.0

import { useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppContext } from '@/contexts/AppContext';
import { useConfig } from '@/contexts/ConfigProvider';
import { SettingsItem } from '@/routes/settings/components/settingsItem/settingsItem';
import { View, ViewButtons, ViewHeader } from '@/components/view/view';
import { Button } from '@/components/forms';
import { UseBackButton } from '@/hooks/backbutton';

export const RestartInTestnetSetting = () => {
  const { t } = useTranslation();
  const { setConfig } = useConfig();
  const [showRestartMessage, setShowRestartMessage] = useState(false);
  const { isTesting } = useContext(AppContext);

  const handleRestart = async () => {
    setShowRestartMessage(true);
    await setConfig({
      backend: {
        startInTestnet: !isTesting
      },
    });
  };

  const handleReset = async () => {
    setShowRestartMessage(false);
    if (!isTesting) {
      await setConfig({
        backend: {
          startInTestnet: false
        },
      });
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
