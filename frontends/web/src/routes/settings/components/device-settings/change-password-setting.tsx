// SPDX-License-Identifier: Apache-2.0

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PointToBitBox02, WarningOLD } from '@/components/icon';
import { changeDevicePassword, errUserAbort } from '@/api/bitbox02';
import { alertUser } from '@/components/alert/Alert';
import { SettingsItem } from '@/routes/settings/components/settingsItem/settingsItem';
import { WaitDialog } from '@/components/wait-dialog/wait-dialog';

type TChangeDevicePasswordSettingProps = {
  deviceID: string;
  canChangePassword: boolean;
};

const ChangePasswordWaitDialog = ({ show }: { show: boolean }) => {
  const { t } = useTranslation();

  if (!show) {
    return null;
  }

  return (
    <WaitDialog title={t('bitbox02Settings.changePassword.title')}>
      <p>{t('bitbox02Interact.followInstructions')}</p>
      <PointToBitBox02 />
    </WaitDialog>
  );
};

export const ChangeDevicePasswordSetting = ({ deviceID, canChangePassword }: TChangeDevicePasswordSettingProps) => {
  const { t } = useTranslation();
  const [showWaitDialog, setShowWaitDialog] = useState(false);

  const handleChangePassword = async () => {
    setShowWaitDialog(true);
    const result = await changeDevicePassword(deviceID);
    setShowWaitDialog(false);
    if (!result.success) {
      if (result.code === errUserAbort) {
        // User canceled on the device
        alertUser(t('bitbox02Settings.changePassword.error_104'));
      }
      return;
    }
    alertUser(t('bitbox02Settings.changePassword.success'));
  };

  if (!canChangePassword) {
    return (
      <SettingsItem
        settingName={t('bitbox02Settings.changePassword.title')}
        secondaryText={t('bitbox02Settings.changePassword.description')}
        extraComponent={<WarningOLD width={20} height={20} />}
        displayedValue={t('bitbox02Wizard.advanced.outOfDate')}
      />
    );
  }

  return (
    <>
      <SettingsItem
        settingName={t('bitbox02Settings.changePassword.title')}
        secondaryText={t('bitbox02Settings.changePassword.description')}
        onClick={handleChangePassword}
      />
      <ChangePasswordWaitDialog show={showWaitDialog} />
    </>
  );
};
