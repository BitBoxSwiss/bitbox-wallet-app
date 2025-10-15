/**
 * Copyright 2023-2024 Shift Crypto AG
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
import { gotoStartupSettings } from '@/api/bitbox02';
import { SettingsItem } from '@/routes/settings/components/settingsItem/settingsItem';
import { WaitDialog } from '@/components/wait-dialog/wait-dialog';

type TGoToStartupSettingsProps = {
  deviceID: string;
};

type TStartupSettingsWaitDialogProps = {
  show: boolean;
};

const StartupSettingsWaitDialog = ({ show }: TStartupSettingsWaitDialogProps) => {
  const { t } = useTranslation();

  if (!show) {
    return null;
  }

  return (
    <WaitDialog
      title={t('bitbox02Settings.gotoStartupSettings.title')} >
      {t('bitbox02Settings.gotoStartupSettings.description')}
    </WaitDialog>
  );
};

const GoToStartupSettings = ({ deviceID }: TGoToStartupSettingsProps) => {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);
  const handleGoToStartupSettings = async () => {
    setShow(true);
    await gotoStartupSettings(deviceID).catch(console.error);
    setShow(false);
  };
  return (
    <>
      <SettingsItem
        settingName={t('bitbox02Settings.gotoStartupSettings.title')}
        secondaryText={t('deviceSettings.expert.goToStartupSettings.description')}
        onClick={handleGoToStartupSettings}
      />
      <StartupSettingsWaitDialog show={show} />
    </>
  );
};

export { GoToStartupSettings };