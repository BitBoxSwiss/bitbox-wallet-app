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

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PointToBitBox02 } from '@/components/icon';
import { changeDevicePassword } from '@/api/bitbox02';
import { alertUser } from '@/components/alert/Alert';
import { SettingsItem } from '@/routes/settings/components/settingsItem/settingsItem';
import { WaitDialog } from '@/components/wait-dialog/wait-dialog';

type TChangeDevicePasswordSettingProps = {
  deviceID: string;
};

type TChangePasswordWaitDialogProps = {
  show: boolean;
};

const ChangePasswordWaitDialog = ({ show }: TChangePasswordWaitDialogProps) => {
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

const ChangeDevicePasswordSetting = ({ deviceID }: TChangeDevicePasswordSettingProps) => {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);

  const handleChangePassword = async () => {
    setShow(true);
    const result = await changeDevicePassword(deviceID);
    setShow(false);
    if (!result.success) {
      console.error(result.message);
      alertUser(result.message || t('genericError'));
      return;
    }
    alertUser(t('bitbox02Settings.changePassword.success'));
  };

  return (
    <>
      <SettingsItem
        settingName={t('bitbox02Settings.changePassword.title')}
        secondaryText={t('bitbox02Settings.changePassword.description')}
        onClick={handleChangePassword}
      />
      <ChangePasswordWaitDialog show={show} />
    </>
  );
};

export { ChangeDevicePasswordSetting };