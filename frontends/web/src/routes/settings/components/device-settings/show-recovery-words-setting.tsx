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
import { SettingsItem } from '@/routes/settings/components/settingsItem/settingsItem';
import { WaitDialog } from '@/components/wait-dialog/wait-dialog';
import { MultilineMarkup, SimpleMarkup } from '@/utils/markup';
import { showMnemonic } from '@/api/bitbox02';
import { Message } from '@/components/message/message';
import { Dialog, DialogButtons } from '@/components/dialog/dialog';
import { Button, Checkbox } from '@/components/forms';

type TProps = {
  deviceID: string;
}

type TDialog = {
  inProgress: boolean;
}

const ShowRecoveryWordsSetting = ({ deviceID }: TProps) => {
  const { t } = useTranslation();
  const [inProgress, setInProgress] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [checked, setChecked] = useState(false);

  const confirmShowWords = async () => {
    setShowDialog(false);
    setInProgress(true);
    await showMnemonic(deviceID);
    setInProgress(false);
  };

  return (
    <>
      <SettingsItem
        settingName={t('backup.showMnemonic.title')}
        secondaryText={t('deviceSettings.backups.showRecoveryWords.description')}
        onClick={() => setShowDialog(true)}
      />
      <ShowMnemonicWaitDialog inProgress={inProgress} />

      <Dialog title={t('backup.showMnemonic.title')} open={showDialog} onClose={() => setShowDialog(false)}>
        <Message type="warning">
          <SimpleMarkup tagName="span" markup={t('backup.showMnemonic.warning')}/>
        </Message>
        <p>
          <MultilineMarkup
            markup={t('backup.showMnemonic.description')}
            tagName="span"
            withBreaks />
        </p>
        <Checkbox
          id="confirmationCheckbox"
          onChange={() => setChecked(prev => !prev)}
          checked={checked}
          label={t('backup.showMnemonic.checkboxLabel')}
        />
        <DialogButtons>
          <Button disabled={!checked} primary onClick={confirmShowWords}>{t('button.next')}</Button>
          <Button secondary onClick={() => setShowDialog(false)}>{t('dialog.cancel')}</Button>
        </DialogButtons>
      </Dialog>
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
      <Message type="warning">
        <SimpleMarkup tagName="span" markup={t('backup.showMnemonic.warning')}/>
      </Message>
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