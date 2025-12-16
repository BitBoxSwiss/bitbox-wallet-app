// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogButtons } from '@/components/dialog/dialog';
import { Button, Checkbox } from '@/components/forms';
import { useLoad } from '@/hooks/api';
import { getConfig, setConfig } from '@/utils/config';

type Props = {
  open: boolean;
  onClose: () => void;
};
export const EnableRememberWalletDialog = ({ open, onClose }: Props) => {
  const { t } = useTranslation();
  const config = useLoad(getConfig);
  const [checked, setChecked] = useState(false);
  const [shouldNotShowDialog, setShouldNotShowDialog] = useState(false);

  useEffect(() => {
    if (config && config.frontend) {
      setShouldNotShowDialog(config.frontend.hideEnableRememberWalletDialog);
    }
  }, [config]);

  if (shouldNotShowDialog) {
    return null;
  }

  return (
    <Dialog title={t('newSettings.appearance.remebmerWallet.enable.title')} medium open={open}>
      <p>{t('newSettings.appearance.remebmerWallet.enable.description')}</p>
      <Checkbox
        id="dont_show_enable_remember_wallet"
        label={t('buy.info.skip')}
        checked={checked}
        onChange={(e) => setChecked(e.target.checked)}
      />
      <DialogButtons>
        <Button primary onClick={() => {
          onClose();
          if (checked) {
            setConfig({ frontend: { hideEnableRememberWalletDialog: true } });
            setShouldNotShowDialog(true);
          }
        }}>{t('button.ok')}</Button>
      </DialogButtons>
    </Dialog>
  );
};
