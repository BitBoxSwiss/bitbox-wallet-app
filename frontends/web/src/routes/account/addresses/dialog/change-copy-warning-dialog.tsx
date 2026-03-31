// SPDX-License-Identifier: Apache-2.0

import { Trans, useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { AccountCode, TUsedAddress } from '@/api/account';
import { Dialog, DialogButtons } from '@/components/dialog/dialog';
import { Button } from '@/components/forms';
import { AddressNotFoundDialog } from './address-not-found-dialog';
import style from '../addresses.module.css';

type TProps = {
  code: AccountCode;
  selectedAddress: TUsedAddress | null;
  onContinue: () => void;
  onClose: () => void;
};

export const ChangeCopyWarningDialog = ({ code, selectedAddress, onContinue, onClose }: TProps) => {
  const { t } = useTranslation();

  if (!selectedAddress) {
    return <AddressNotFoundDialog onClose={onClose} />;
  }

  return (
    <Dialog open medium onClose={onClose}>
      <div className={[style.verifyDialogContent, style.verifySkipDialogContent].join(' ')}>
        <p className={style.sheetBody}>
          <Trans
            i18nKey="addresses.changeCopyBody"
            components={{
              receiveLink: <Link className={style.inlineLink} to={`/account/${code}/receive`} />,
            }}
          />
        </p>

        <DialogButtons>
          <Button primary onClick={onContinue}>
            {t('button.continue')}
          </Button>
          <Button secondary onClick={onClose}>
            {t('dialog.cancel')}
          </Button>
        </DialogButtons>
      </div>
    </Dialog>
  );
};
