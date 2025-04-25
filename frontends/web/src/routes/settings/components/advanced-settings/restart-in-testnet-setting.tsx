
/**
 * Copyright 2025 Shift Crypto AG
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

import { Dispatch, useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TConfig } from '@/routes/settings/advanced-settings';
import { AppContext } from '@/contexts/AppContext';
import { SettingsItem } from '@/routes/settings/components/settingsItem/settingsItem';
import { View, ViewButtons, ViewContent, ViewHeader } from '@/components/view/view';
import { PointToBitBox02 } from '@/components/icon';
import { Button } from '@/components/forms';
import { setConfig } from '@/utils/config';
import { UseBackButton } from '@/hooks/backbutton';

type TProps = {
  onChangeConfig: Dispatch<TConfig>;
}

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
        <ViewContent minHeight="260px">
          <PointToBitBox02 />
        </ViewContent>
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
