// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AccountCode, TUsedAddress } from '@/api/account';
import { A } from '@/components/anchor/anchor';
import { Button } from '@/components/forms';
import { Copy, ExternalLink, OutlinedFileProtectPrimary } from '@/components/icon';
import style from './addresses.module.css';

type TProps = {
  code: AccountCode;
  address: TUsedAddress;
  blockExplorerAddressPrefix?: string;
  onCopy: (address: TUsedAddress) => void;
};

export const AddressActions = ({ code, address, blockExplorerAddressPrefix, onCopy }: TProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <div className={style.inlineActions}>
      <Button transparent inline className={style.linkAction} onClick={() => onCopy(address)}>
        <span className={style.linkActionLabel}>
          <Copy className={style.linkActionIcon} />
          {t('button.copyAddress')}
        </span>
      </Button>
      {address.canSignMsg && (
        <Button transparent inline className={style.linkAction} onClick={() => navigate(`/account/${code}/addresses/${address.addressID}/sign-message`)}>
          <span className={style.linkActionLabel}>
            <OutlinedFileProtectPrimary className={style.linkActionIcon} />
            {t('signMessage.signMessage')}
          </span>
        </Button>
      )}
      {blockExplorerAddressPrefix && (
        <A
          className={style.linkAction}
          href={`${blockExplorerAddressPrefix}${address.address}`}
          title={`${t('transaction.explorerTitle')}\n${blockExplorerAddressPrefix}${address.address}`}>
          <span className={style.linkActionLabel}>
            <ExternalLink className={style.linkActionIcon} />
            {t('transaction.explorerTitle')}
          </span>
        </A>
      )}
    </div>
  );
};
