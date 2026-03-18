// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { TUsedAddress } from '@/api/account';
import { Button } from '@/components/forms';
import { Copy } from '@/components/icon';
import style from './addresses.module.css';

type TProps = {
  address: TUsedAddress;
  onVerify: (addressID: string) => void;
};

export const AddressActions = ({ address, onVerify }: TProps) => {
  const { t } = useTranslation();
  return (
    <div className={style.inlineActions}>
      {address.addressType !== 'change' && (
        <Button transparent inline className={style.linkAction} onClick={() => onVerify(address.addressID)}>
          <span className={style.linkActionLabel}>
            <Copy className={style.linkActionIcon} />
            {t('button.copy')} {t('addresses.detail.address')}
          </span>
        </Button>
      )}
    </div>
  );
};
