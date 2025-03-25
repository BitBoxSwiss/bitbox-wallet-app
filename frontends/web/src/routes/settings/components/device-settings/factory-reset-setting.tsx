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

import { useTranslation } from 'react-i18next';
import { SettingsItem } from '@/routes/settings/components/settingsItem/settingsItem';
import {
  ChevronRightDark,
  WarningOutlined,
  PointToBitBox02,
} from '@/components/icon';
import { Dialog, DialogButtons } from '@/components/dialog/dialog';
import { Button, Checkbox } from '@/components/forms';
import { ChangeEvent, useState } from 'react';
import { resetDevice } from '@/api/bitbox02';
import { alertUser } from '@/components/alert/Alert';
import styles from './factory-reset-setting.module.css';
import { WaitDialog } from '@/components/wait-dialog/wait-dialog';

type TProps = {
  deviceID: string;
};

type TDialog = {
  open: boolean;
  handleCloseDialog: () => void;
  understand: boolean;
  handleUnderstandChange: (e: ChangeEvent<HTMLInputElement>) => void;
  handleReset: () => void;
};

type TWaitDialog = {
  isConfirming: boolean;
};

const FactoryResetSetting = ({ deviceID }: TProps) => {
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

  const settingName = (
    <div className={styles.settingNameContainer}>
      <WarningOutlined width={16} height={16} />
      <p className={styles.settingName}>
        {t('deviceSettings.expert.factoryReset.title')}
      </p>
    </div>
  );

  return (
    <>
      <SettingsItem
        settingName={settingName}
        secondaryText={t('deviceSettings.expert.factoryReset.description')}
        extraComponent={<ChevronRightDark />}
        onClick={() => setActiveDialog(true)}
      />
      <FactoryResetDialog
        open={activeDialog}
        handleCloseDialog={abort}
        understand={understand}
        handleUnderstandChange={handleUnderstandChange}
        handleReset={reset}
      />
      <FactoryResetWaitDialog isConfirming={isConfirming} />
    </>
  );
};

const FactoryResetDialog = ({
  open,
  handleCloseDialog,
  understand,
  handleUnderstandChange,
  handleReset,
}: TDialog) => {
  const { t } = useTranslation();
  return (
    <Dialog
      open={open}
      title={t('reset.title')}
      onClose={handleCloseDialog}
      small
    >
      <div className="columnsContainer half">
        <div className="columns">
          <div className="column">
            <p>{t('reset.description')}</p>
            <div>
              <Checkbox
                id="reset_understand"
                label={t('reset.understandBB02')}
                checked={understand}
                onChange={handleUnderstandChange}
              />
            </div>
          </div>
        </div>
      </div>
      <DialogButtons>
        <Button danger disabled={!understand} onClick={handleReset}>
          {t('reset.title')}
        </Button>
      </DialogButtons>
    </Dialog>
  );
};

const FactoryResetWaitDialog = ({ isConfirming }: TWaitDialog) => {
  const { t } = useTranslation();
  if (!isConfirming) {
    return null;
  }
  return (
    <WaitDialog title={t('reset.title')}>
      {t('bitbox02Interact.followInstructions')}
      <PointToBitBox02 />
    </WaitDialog>
  );
};

export { FactoryResetSetting };
