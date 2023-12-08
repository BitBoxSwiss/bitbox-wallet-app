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

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Toggle } from '../../../../components/toggle/toggle';
import { SettingsItem } from '../settingsItem/settingsItem';
import * as backendAPI from '../../../../api/backend';
import { useLoad } from '../../../../hooks/api';
import { getConfig } from '../../../../utils/config';
import { Dialog, DialogButtons } from '../../../../components/dialog/dialog';
import { Button } from '../../../../components/forms';

export const WatchonlySetting = () => {
  const { t } = useTranslation();
  const [disabled, setDisabled] = useState<boolean>(false);
  const [watchonly, setWatchonly] = useState<boolean>();
  const [warningDialogOpen, setWarningDialogOpen] = useState(false);
  const config = useLoad(getConfig);

  useEffect(() => {
    if (config) {
      setWatchonly(config.backend.watchonly);
    }
  }, [config]);

  const toggleWatchonly = async () => {
    if (!watchonly) {
      setDisabled(true);
      const { success } = await backendAPI.setWatchonly(!watchonly);

      if (success) {
        setWatchonly(!watchonly);
      }
      setDisabled(false);
      return;
    }

    setWarningDialogOpen(true);
    setDisabled(false);
  };


  const handleCloseDialog = () => {
    setWarningDialogOpen(false);
    setDisabled(false);
  };

  const handleConfirmDisableWatchonly = async () => {
    setDisabled(true);
    await backendAPI.setWatchonly(false);
    setWatchonly(false);
    setDisabled(false);
    setWarningDialogOpen(false);
  };

  return (
    <>
      <Dialog title={t('newSettings.appearance.watchonly.warningTitle')} medium onClose={handleCloseDialog} open={warningDialogOpen}>
        <p>{t('newSettings.appearance.watchonly.warning')}</p>
        <DialogButtons>
          <Button primary onClick={handleConfirmDisableWatchonly}>{t('dialog.confirm')}</Button>
          <Button secondary onClick={handleCloseDialog}>{t('dialog.cancel')}</Button>
        </DialogButtons>
      </Dialog>
      <SettingsItem
        settingName={t('newSettings.appearance.watchonly.title')}
        secondaryText={t('newSettings.appearance.watchonly.description')}
        extraComponent={
          <>
            {
              watchonly !== undefined ?
                (
                  <Toggle
                    checked={watchonly}
                    disabled={disabled}
                    onChange={toggleWatchonly}
                  />
                ) :
                null
            }
          </>
        }
      />
    </>
  );
};
