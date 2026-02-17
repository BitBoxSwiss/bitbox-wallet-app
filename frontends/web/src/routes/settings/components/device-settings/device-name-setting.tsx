// SPDX-License-Identifier: Apache-2.0

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SettingsItem } from '@/routes/settings/components/settingsItem/settingsItem';
import { Button, Input } from '@/components/forms';
import { Dialog, DialogButtons } from '@/components/dialog/dialog';
import { getDeviceInfo, setDeviceName, errUserAbort } from '@/api/bitbox02';
import { alertUser } from '@/components/alert/Alert';
import { WaitDialog } from '@/components/wait-dialog/wait-dialog';
import { DeviceNameErrorMessage } from '@/routes/device/bitbox02/setup/name';
import { useValidateDeviceName } from '@/hooks/devicename';
import nameStyle from '@/routes/device/bitbox02/setup/name.module.css';

type TDeviceNameSettingProps = {
  deviceName: string;
  deviceID: string;
};

type TDialogProps = {
  open: boolean;
  onClose: () => void;
  currentName: string;
  onInputChange: (value: string) => void;
  name: string;
  handleUpdateName: () => void;
};

type TWaitDialogProps = {
  inProgress: boolean;
};

const DeviceNameSetting = ({ deviceName, deviceID }: TDeviceNameSettingProps) => {
  const { t } = useTranslation();

  const [active, setActive] = useState(false);
  const [currentName, setCurrentName] = useState(deviceName);
  const [name, setName] = useState('');
  const [inProgress, setInProgress] = useState(false);

  const updateName = async () => {
    setInProgress(true);
    try {
      const setNameResult = await setDeviceName(deviceID, name);
      if (!setNameResult.success) {
        // Distinguish “user aborted” (code 104) from other failures
        if (setNameResult.code === errUserAbort) {
          alertUser(t('bitbox02Settings.deviceName.error_104'));
          return;
        }
        throw new Error(setNameResult.message);
      }
      const deviceInfoResult = await getDeviceInfo(deviceID);
      if (!deviceInfoResult.success) {
        throw new Error(deviceInfoResult.message);
      }
      setCurrentName(deviceInfoResult.deviceInfo.name);
    } catch (error) {
      alertUser(t('bitbox02Settings.deviceName.error'));
      console.error(error);
    } finally {
      setActive(false);
      setInProgress(false);
    }
  };

  const handleCloseDialog = () => {
    setActive(false);
    setName('');
  };

  return (
    <>
      <SettingsItem
        settingName={t('bitbox02Settings.deviceName.input')}
        secondaryText={t('deviceSettings.deviceInformation.deviceName.description')}
        displayedValue={currentName}
        onClick={() => setActive(true)}
      />

      <SetDeviceNameDialog
        open={active}
        onClose={handleCloseDialog}
        currentName={currentName}
        onInputChange={setName}
        name={name}
        handleUpdateName={updateName}
      />
      <SetDeviceNameWaitDialog inProgress={inProgress} />
    </>
  );
};

const SetDeviceNameDialog = ({ open, onClose, currentName, onInputChange, name, handleUpdateName }: TDialogProps) => {
  const { t } = useTranslation();
  const { error, invalidChars, nameIsTooShort } = useValidateDeviceName(name);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('bitbox02Settings.deviceName.title')}
      small>
      <p className="m-top-none m-bottom-half">
        {t('bitbox02Settings.deviceName.current')}
        <br />
        {currentName}
      </p>
      <Input
        autoFocus
        className={error && !nameIsTooShort ? nameStyle.inputError : ''}
        label={t('bitbox02Settings.deviceName.input')}
        onInput={(e) => onInputChange(e.target.value)}
        placeholder={t('bitbox02Settings.deviceName.placeholder')}
        value={name}
        id="deviceName"
      />
      <DeviceNameErrorMessage error={error} invalidChars={invalidChars} />
      <DialogButtons>
        <Button
          primary
          disabled={!!error}
          onClick={handleUpdateName}
        >
          {t('button.ok')}
        </Button>
      </DialogButtons>
    </Dialog>
  );
};

const SetDeviceNameWaitDialog = ({ inProgress }: TWaitDialogProps) => {
  const { t } = useTranslation();

  if (!inProgress) {
    return null;
  }

  return (
    <WaitDialog>
      {t('bitbox02Interact.followInstructions')}
    </WaitDialog>
  );
};

export { DeviceNameSetting };