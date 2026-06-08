// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { Dialog, DialogButtons } from '@/components/dialog/dialog';
import { Button } from '@/components/forms';

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
};
export const DisableRememberWalletDialog = ({ open, onClose, onConfirm }: Props) => {
  const { t } = useTranslation();

  return (
    <Dialog title={t('newSettings.appearance.remebmerWallet.warningTitle')} medium onClose={onClose} open={open}>
      <p>{t('newSettings.appearance.remebmerWallet.warning')}</p>
      <DialogButtons>
        <Button primary onClick={onConfirm}>{t('dialog.confirm')}</Button>
        <Button secondary onClick={onClose}>{t('dialog.cancel')}</Button>
      </DialogButtons>
    </Dialog>
  );
};
