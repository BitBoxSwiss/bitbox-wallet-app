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

import { useState, ChangeEvent, FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/forms';
import { alertUser } from '@/components/alert/Alert';
import { DialogLegacy, DialogButtons } from '@/components/dialog/dialog-legacy';
import { WaitDialog } from '@/components/wait-dialog/wait-dialog';
import { PasswordInput, PasswordRepeatInput } from '@/components/password';
import { apiPost } from '@/utils/request';
import { SettingsButton } from '@/components/settingsButton/settingsButton';

type Props = {
  deviceID: string;
  disabled?: boolean;
}

export const ChangePIN = ({ deviceID, disabled }: Props) => {
  const { t } = useTranslation();

  const [oldPIN, setOldPIN] = useState<string | null>(null);
  const [newPIN, setNewPIN] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<number | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [activeDialog, setActiveDialog] = useState(false);

  const abort = () => {
    setOldPIN(null);
    setNewPIN(null);
    setIsConfirming(false);
    setActiveDialog(false);
    setErrorCode(null);
  };

  const validate = () => {
    return Boolean(newPIN && oldPIN);
  };

  const changePin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validate()) return;

    setActiveDialog(false);
    setIsConfirming(true);

    try {
      const data = await apiPost(`devices/${deviceID}/change-password`, {
        oldPIN,
        newPIN,
      });

      abort();

      if (!data.success) {
        alertUser(
          t(`bitbox.error.e${data.code}`, {
            defaultValue: data.errorMessage,
          })
        );
        setErrorCode(data.code);
      }
    } catch (error) {
      abort();
      alertUser(String(error));
    }
  };

  const handleOldPINChange = (e: ChangeEvent<HTMLInputElement>) => {
    setOldPIN(e.target.value);
  };

  const handleNewPINValid = (pin: string | null) => {
    setNewPIN(pin);
  };

  return (
    <div>
      <SettingsButton disabled={disabled} onClick={() => setActiveDialog(true)}>
        {t('button.changepin')}
      </SettingsButton>

      {activeDialog && (
        <DialogLegacy title={t('button.changepin')} onClose={abort}>
          <form onSubmit={changePin}>
            <PasswordInput
              id="oldPIN"
              label={t('changePin.oldLabel')}
              value={oldPIN || ''}
              onInput={handleOldPINChange}
            />

            {t('changePin.newTitle') && <h4>{t('changePin.newTitle')}</h4>}

            <PasswordRepeatInput
              pattern="^.{4,}$"
              label={t('initialize.input.label')}
              repeatLabel={t('initialize.input.labelRepeat')}
              repeatPlaceholder={t('initialize.input.placeholderRepeat')}
              onValidPassword={handleNewPINValid}
            />

            <DialogButtons>
              <Button type="submit" danger disabled={!validate() || isConfirming}>
                {t('button.changepin')}
              </Button>
              <Button secondary onClick={abort} disabled={isConfirming}>
                {t('button.back')}
              </Button>
            </DialogButtons>
          </form>
        </DialogLegacy>
      )}

      {isConfirming && <WaitDialog title={t('button.changepin')} />}
    </div>
  );
};
