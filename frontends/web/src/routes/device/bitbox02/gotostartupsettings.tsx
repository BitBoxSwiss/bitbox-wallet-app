/**
 * Copyright 2021 Shift Crypto AG
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

import { useState } from 'react';
import { apiPost } from '../../../utils/request';
import { SettingsButton } from '../../../components/settingsButton/settingsButton';
import { WaitDialog } from '../../../components/wait-dialog/wait-dialog';
import { useTranslation } from 'react-i18next';

type TProps = {
    deviceID: string;
}

export const GotoStartupSettings = ({ deviceID }: TProps) => {
  const [isConfirming, setIsConfirming] = useState(false);
  const { t } = useTranslation();

  const gotoStartupSettings = async () => {
    setIsConfirming(true);
    await apiPost(`devices/bitbox02/${deviceID}/goto-startup-settings`).catch(console.error);
    setIsConfirming(false);
  };

  return (
    <div>
      <SettingsButton
        onClick={gotoStartupSettings}>
        {t('bitbox02Settings.gotoStartupSettings.title')}
      </SettingsButton>
      {
        isConfirming && (
          <WaitDialog
            title={t('bitbox02Settings.gotoStartupSettings.title')} >
            {t('bitbox02Settings.gotoStartupSettings.description')}
          </WaitDialog>
        )
      }
    </div>
  );
};
