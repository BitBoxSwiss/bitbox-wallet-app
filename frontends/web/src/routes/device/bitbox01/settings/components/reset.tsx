/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2021-2025 Shift Crypto AG
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
import { useState, ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { route } from '@/utils/route';
import { Button, Checkbox } from '@/components/forms';
import { DialogLegacy, DialogButtons } from '@/components/dialog/dialog-legacy';
import { WaitDialog } from '@/components/wait-dialog/wait-dialog';
import { PasswordInput } from '@/components/password';
import { apiPost } from '@/utils/request';
import { alertUser } from '@/components/alert/Alert';
import { SettingsButton } from '@/components/settingsButton/settingsButton';
import style from '../../bitbox01.module.css';

type Props = {
  deviceID: string;
}

export const Reset = ({ deviceID }: Props) => {
  const { t } = useTranslation();

  const [pin, setPin] = useState<string | null>(null);
  const [understand, setUnderstand] = useState(false);
  const [activeDialog, setActiveDialog] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  const handleUnderstandChange = (e: ChangeEvent<HTMLInputElement>) => {
    setUnderstand(e.target.checked);
  };

  const setValidPIN = (e: ChangeEvent<HTMLInputElement>) => {
    setPin(e.target.value);
  };

  const abort = () => {
    setPin(null);
    setUnderstand(false);
    setActiveDialog(false);
    setIsConfirming(false);
  };

  const resetDevice = async () => {
    setActiveDialog(false);
    setIsConfirming(true);

    try {
      const data = await apiPost(`devices/${deviceID}/reset`, { pin });

      abort();

      if (data.success) {
        if (data.didReset) {
          route('/', true);
        }
      } else if (data.errorMessage) {
        alertUser(
          t(`bitbox.error.e${data.code as string}`, {
            defaultValue: data.errorMessage,
          })
        );
      }
    } catch (err) {
      abort();
      alertUser(String(err));
    }
  };

  return (
    <div>
      <SettingsButton danger onClick={() => setActiveDialog(true)}>
        {t('reset.title')}
      </SettingsButton>

      {activeDialog && (
        <DialogLegacy title={t('reset.title')} onClose={abort}>
          <p>{t('reset.description')}</p>

          <PasswordInput
            id="pin"
            label={t('initialize.input.label')}
            value={pin || ''}
            onInput={setValidPIN}
          />

          <div className={style.agreements}>
            <Checkbox
              id="funds_access"
              label={t('reset.understand')}
              checked={understand}
              onChange={handleUnderstandChange}
            />
          </div>

          <DialogButtons>
            <Button danger disabled={!pin || !understand} onClick={resetDevice}>
              {t('reset.title')}
            </Button>
            <Button secondary onClick={abort} disabled={isConfirming}>
              {t('button.back')}
            </Button>
          </DialogButtons>
        </DialogLegacy>
      )}

      {isConfirming && <WaitDialog title={t('reset.title')} />}
    </div>
  );
};
