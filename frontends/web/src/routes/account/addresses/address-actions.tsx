// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AccountCode, TUsedAddress } from '@/api/account';
import { Button } from '@/components/forms';
import { CopyAddressButton } from '@/components/copy/copy-address-button';
import { OutlinedFileProtectPrimary } from '@/components/icon';
import style from './addresses.module.css';

type TProps = {
  code: AccountCode;
  address: TUsedAddress;
  onCopy: (address: TUsedAddress) => void;
};

export const AddressActions = ({ code, address, onCopy }: TProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <div className={style.inlineActions}>
      <CopyAddressButton mode="action" onClick={() => onCopy(address)} />
      {address.canSignMsg && (
        <Button transparent inline className={style.linkAction} onClick={() => navigate(`/account/${code}/addresses/${address.addressID}/sign-message`)}>
          <span className={style.linkActionLabel}>
            <OutlinedFileProtectPrimary className={style.linkActionIcon} />
            {t('signMessage.signMessage')}
          </span>
        </Button>
      )}
    </div>
  );
};
