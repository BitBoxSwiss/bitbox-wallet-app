/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2022 Shift Crypto AG
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

import { useState, useRef, FunctionComponent } from 'react';
import { useTranslation } from 'react-i18next';
import { getDeviceInfo, setDeviceName } from '../../../api/bitbox02';
import { Button, Input } from '../../../components/forms';
import { Dialog, DialogButtons } from '../../../components/dialog/dialog';
import { alertUser } from '../../../components/alert/Alert';
import { SettingsButton } from '../../../components/settingsButton/settingsButton';
import { WaitDialog } from '../../../components/wait-dialog/wait-dialog';

type Props = {
    deviceName?: string;
    deviceID: string;
}

export const SetDeviceName: FunctionComponent<Props> = ({
  deviceName,
  deviceID,
}) => {
  const { t } = useTranslation();

  const [active, setActive] = useState(false);
  const [currentName, setCurrentName] = useState(deviceName);
  const [name, setName] = useState('');
  const [inProgress, setInProgress] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  const updateName = async () => {
    setInProgress(true);
    try {
      await setDeviceName(deviceID, name);
      const { name: newDeviceName } = await getDeviceInfo(deviceID);
      setCurrentName(newDeviceName);
    } catch (e) {
      alertUser('Device name could not be set')
    } finally {
      setActive(false);
      setInProgress(false);
    }
  };

  return (
    <div>
      <SettingsButton
        onClick={() => {
          setName('');
          setActive(true);
        }}
        optionalText={currentName}>
        {t('bitbox02Settings.deviceName.title')}
      </SettingsButton>
      { active ? (
        <Dialog
          onClose={() => setActive(false)}
          title={t('bitbox02Settings.deviceName.title')}
          small>
          <div className="columnsContainer half">
            <div className="columns half">
              <div className="column">
                <label>
                  {t('bitbox02Settings.deviceName.current')}
                </label>
                <p className="m-bottom-half">
                  {currentName}
                </p>
              </div>
              <div className="column">
                <Input
                  pattern="^.{0,63}$"
                  label={t('bitbox02Settings.deviceName.input')}
                  onInput={e => setName(e.target.value)}
                  ref={inputRef}
                  placeholder={t('bitbox02Settings.deviceName.placeholder')}
                  value={name}
                  id="deviceName" />
              </div>
            </div>
          </div>
          <DialogButtons>
            <Button
              primary
              disabled={!(name && inputRef?.current?.validity.valid)}
              onClick={() => updateName()}>
              {t('button.ok')}
            </Button>
          </DialogButtons>
        </Dialog>
      ) : null }
      { inProgress && (
        <WaitDialog>
          {t('bitbox02Interact.followInstructions')}
        </WaitDialog>
      )}
    </div>
  );
};
