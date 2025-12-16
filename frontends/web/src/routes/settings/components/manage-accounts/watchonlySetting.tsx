// SPDX-License-Identifier: Apache-2.0

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
};

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
