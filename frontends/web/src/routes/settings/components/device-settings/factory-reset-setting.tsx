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

import { ChangeEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { resetDevice } from '@/api/bitbox02';
import { SettingsItem } from '@/routes/settings/components/settingsItem/settingsItem';
import { WarningOutlined, PointToBitBox02 } from '@/components/icon';
import { Dialog, DialogButtons } from '@/components/dialog/dialog';
import { Button, Checkbox } from '@/components/forms';
import { alertUser } from '@/components/alert/Alert';
import { WaitDialog } from '@/components/wait-dialog/wait-dialog';
import styles from './factory-reset-setting.module.css';

type TProps = {
  deviceID: string;
}

export const FactoryResetSetting = ({ deviceID }: TProps) => {
  const [understand, setUnderstand] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [activeDialog, setActiveDialog] = useState(false);
  const { t } = useTranslation();

  const abort = () => {
    setUnderstand(false);
    setIsConfirming(false);
    setActiveDialog(false);
  };

  const handleUnderstandChange = (e: ChangeEvent<HTMLInputElement>) => {
    setUnderstand(e.target.checked);
  };

  const reset = async () => {
    setActiveDialog(false);
    setIsConfirming(true);
    const responseData = await resetDevice(deviceID);
    abort();
    if (!responseData.success) {
      alertUser(t('reset.notReset'));
    }
  };

  return (
    <>
      <SettingsItem
        settingName={
          <div className={styles.settingNameContainer}>
            <WarningOutlined width={16} height={16} />
            <p className={styles.settingName}>
              {t('deviceSettings.expert.factoryReset.title')}
            </p>
          </div>
        }
        secondaryText={t('deviceSettings.expert.factoryReset.description')}
        onClick={() => setActiveDialog(true)}
      />
      <Dialog
        open={activeDialog}
        title={t('reset.title')}
        onClose={abort}
        small>
        <p>{t('reset.description')}</p>
        <Checkbox
          id="reset_understand"
          label={t('reset.understandBB02')}
          checked={understand}
          onChange={handleUnderstandChange} />
        <DialogButtons>
          <Button danger disabled={!understand} onClick={reset}>
            {t('reset.title')}
          </Button>
        </DialogButtons>
      </Dialog>
      {isConfirming && (
        <WaitDialog
          title={t('reset.title')} >
          {t('bitbox02Interact.followInstructions')}
          <PointToBitBox02 />
        </WaitDialog>
      )}
    </>
  );
};
