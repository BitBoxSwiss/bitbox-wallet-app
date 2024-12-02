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
import { Toggle } from '@/components/toggle/toggle';
import * as backendAPI from '@/api/backend';
import * as accountAPI from '@/api/account';
import { useLoad } from '@/hooks/api';
import { getConfig } from '@/utils/config';
import { Label } from '@/components/forms';
import { EnableRememberWalletDialog } from '@/routes/settings/components/manage-accounts/dialogs/enableRememberWalletDialog';
import { DisableRememberWalletDialog } from '@/routes/settings/components/manage-accounts/dialogs/disableRememberWalletDialog';
import style from './watchonlySettings.module.css';

type Props = {
  keystore: accountAPI.TKeystore;
}

export const WatchonlySetting = ({ keystore }: Props) => {
  const { t } = useTranslation();
  const [disabled, setDisabled] = useState<boolean>(false);
  const [watchonly, setWatchonly] = useState<boolean>();
  const [warningDialogOpen, setWarningDialogOpen] = useState(false);
  const [walletRememberedDialogOpen, setWalletRememberedDialogOpen] = useState(false);
  const config = useLoad(getConfig);

  useEffect(() => {
    if (config) {
      setWatchonly(keystore.watchonly);
    }
  }, [config, keystore]);

  const toggleWatchonly = async () => {
    if (!watchonly) {
      setDisabled(true);
      const { success } = await backendAPI.setWatchonly(keystore.rootFingerprint, !watchonly);

      if (success) {
        setWatchonly(!watchonly);
        setWalletRememberedDialogOpen(true);
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
    await backendAPI.setWatchonly(keystore.rootFingerprint, false);
    setWatchonly(false);
    setDisabled(false);
    setWarningDialogOpen(false);
  };

  return (
    <>
      <DisableRememberWalletDialog
        open={warningDialogOpen}
        onClose={handleCloseDialog}
        onConfirm={handleConfirmDisableWatchonly}
      />
      <EnableRememberWalletDialog
        open={walletRememberedDialogOpen}
        onClose={() => setWalletRememberedDialogOpen(false)}
      />
      { watchonly !== undefined ? (
        <Label className={style.label}>
          <span className={style.labelText}>
            {t('newSettings.appearance.remebmerWallet.name')}
          </span>
          <Toggle
            checked={watchonly}
            disabled={disabled}
            onChange={toggleWatchonly}
          />
        </Label>
      ) : null}
    </>
  );
};
