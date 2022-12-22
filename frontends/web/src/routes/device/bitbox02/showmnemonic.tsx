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

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { showMnemonic } from '../../../api/bitbox02';
import { SimpleMarkup } from '../../../utils/markup';
import { confirmation } from '../../../components/confirm/Confirm';
import { SettingsButton } from '../../../components/settingsButton/settingsButton';
import { WaitDialog } from '../../../components/wait-dialog/wait-dialog';

export type TProps = {
  deviceID: string;
};

export const ShowMnemonic = ({ deviceID }: TProps) => {
  const { t } = useTranslation();
  const [inProgress, setInProgress] = useState<boolean>(false);

  const handleShowMnemonic = () => {
    confirmation(t('backup.showMnemonic.description'), async result => {
      if (result) {
        setInProgress(true);
        await showMnemonic(deviceID);
        setInProgress(false);
      }
    });
  };

  return (
    <div>
      <SettingsButton
        onClick={handleShowMnemonic}>
        {t('backup.showMnemonic.title')}
      </SettingsButton>
      { inProgress && (
        <WaitDialog title={t('backup.showMnemonic.title')}>
          <p>
            { t('backup.showMnemonic.description').split('\n').map((line, i) => (
              <span key={`${line}-${i}`}>
                <SimpleMarkup tagName="span" markup={line} /><br/>
              </span>
            )) }
          </p>
          <p>{t('bitbox02Interact.followInstructions')}</p>
        </WaitDialog>
      )}
    </div>
  );
};
