// SPDX-License-Identifier: Apache-2.0

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