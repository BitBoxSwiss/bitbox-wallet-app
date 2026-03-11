// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { TUsedAddress } from '@/api/account';
import { Button } from '@/components/forms';
import { Copy } from '@/components/icon';
import style from './addresses.module.css';

type TProps = {
  address: TUsedAddress;
  onCopy: (address: TUsedAddress) => void;
};

export const AddressActions = ({ address, onCopy }: TProps) => {
  const { t } = useTranslation();
  return (
    <div className={style.inlineActions}>
      <Button transparent inline className={style.linkAction} onClick={() => onCopy(address)}>
        <span className={style.linkActionLabel}>
          <Copy className={style.linkActionIcon} />
          {t('button.copyAddress')}
        </span>
      </Button>
    </div>
  );
};
