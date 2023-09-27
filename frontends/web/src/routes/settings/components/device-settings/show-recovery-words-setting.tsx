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

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SettingsItem } from '../settingsItem/settingsItem';
import { ChevronRightDark } from '../../../../components/icon';
import { WaitDialog } from '../../../../components/wait-dialog/wait-dialog';
import { MultilineMarkup } from '../../../../utils/markup';
import { showMnemonic } from '../../../../api/bitbox02';
import { confirmation } from '../../../../components/confirm/Confirm-Legacy';

type TProps = {
  deviceID: string;
}

type TDialog = {
  inProgress: boolean;
}

const ShowRecoveryWordsSetting = ({ deviceID }: TProps) => {
  const { t } = useTranslation();
  const [inProgress, setInProgress] = useState(false);

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
    <>
      <SettingsItem
        settingName={t('backup.showMnemonic.title')}
        secondaryText={t('deviceSettings.backups.showRecoveryWords.description')}
        extraComponent={<ChevronRightDark />}
        onClick={handleShowMnemonic}
      />
      <ShowMnemonicWaitDialog inProgress={inProgress} />
    </>
  );
};

const ShowMnemonicWaitDialog = ({ inProgress }: TDialog) => {
  const { t } = useTranslation();

  if (!inProgress) {
    return null;
  }

  return (
    <WaitDialog title={t('backup.showMnemonic.title')}>
      <p>
        <MultilineMarkup
          markup={t('backup.showMnemonic.description')}
          tagName="span"
          withBreaks />
      </p>
      <p>{t('bitbox02Interact.followInstructions')}</p>
    </WaitDialog>
  );
};


export { ShowRecoveryWordsSetting };