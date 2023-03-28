/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2021 Shift Crypto AG
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
import { alertUser } from '../../../components/alert/Alert';
import { Dialog, DialogButtons } from '../../../components/dialog/dialog';
import { Button, Checkbox } from '../../../components/forms';
import { SettingsButton } from '../../../components/settingsButton/settingsButton';
import { WaitDialog } from '../../../components/wait-dialog/wait-dialog';
import { resetDevice } from '../../../api/bitbox02';

type TProps = {
    deviceID: string;
}

export const Reset = ({ deviceID }: TProps) => {
  const [understand, setUnderstand] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [activeDialog, setActiveDialog] = useState(false);
  const { t } = useTranslation();

  const reset = async () => {
    setActiveDialog(false);
    setIsConfirming(true);
    const responseData = await resetDevice(deviceID);
    abort();
    if (!responseData.success) {
      alertUser(t('reset.notReset'));
    }
  };

  const abort = () => {
    setUnderstand(false);
    setIsConfirming(false);
    setActiveDialog(false);
  };

  const handleUnderstandChange = (e: ChangeEvent<HTMLInputElement>) => {
    setUnderstand(e.target.checked);
  };
  return (
    <div>
      <SettingsButton
        danger
        onClick={() => setActiveDialog(true)}>
        {t('reset.title')}
      </SettingsButton>
      <Dialog
        open={activeDialog}
        title={t('reset.title')}
        onClose={abort}
        disabledClose={isConfirming}
        small>
        <div className="columnsContainer half">
          <div className="columns">
            <div className="column">
              <p>{t('reset.description')}</p>
              <div>
                <Checkbox
                  id="reset_understand"
                  label={t('reset.understandBB02')}
                  checked={understand}
                  onChange={handleUnderstandChange} />
              </div>
            </div>
          </div>
        </div>
        <DialogButtons>
          <Button danger disabled={!understand} onClick={reset}>
            {t('reset.title')}
          </Button>
        </DialogButtons>
      </Dialog>
      {
        isConfirming && (
          <WaitDialog
            title={t('reset.title')} >
            {t('bitbox02Interact.followInstructions')}
          </WaitDialog>
        )
      }
    </div>
  );
};

