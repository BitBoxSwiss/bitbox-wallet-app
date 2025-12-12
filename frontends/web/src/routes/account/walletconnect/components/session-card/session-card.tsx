// SPDX-License-Identifier: Apache-2.0

import { CoreTypes } from '@walletconnect/types';
import { Button } from '@/components/forms';
import { useTranslation } from 'react-i18next';
import { useLoad } from '@/hooks/api';
import { getEthAccountCodeAndNameByAddress } from '@/api/account';
import { truncateAddress } from '@/utils/walletconnect';
import styles from './session-card.module.css';

type TTextDataProps = {
  accountName: string;
  receiveAddress: string;
  dAppName: string;
  dAppUrl: string;
  iconUrl?: string;
};

type TWCSessionCardProps = {
  metadata: CoreTypes.Metadata;
  onDisconnect: () => void;
  receiveAddress: string;
};

const TextData = ({ accountName, receiveAddress, dAppName, dAppUrl, iconUrl }: TTextDataProps) => {
  return (
    <div className={styles.textDataContainer}>
      <div className={styles.accountNameAndWalletContainer}>
        <p className={styles.accountName}>
          {accountName}
        </p>
        <p className={`${styles.receiveAddress || ''} hide-on-small`}>
          {receiveAddress}
        </p>
      </div>
      <p className={`${styles.receiveAddress || ''} show-on-small`}>
        {receiveAddress}
      </p>
      <div className={styles.dAppMetadataAndIconContainer}>
        <div className={styles.dAppNameAndUrlContainer}>
          <p>{dAppName}</p>
          <p className={styles.dappUrl}>
            {dAppUrl}
          </p>
        </div>
        {iconUrl && (
          <img className="hide-on-small" src={iconUrl} alt="dApp icon" />
        )}
      </div>
    </div>
  );
};

export const WCSessionCard = ({ metadata, receiveAddress, onDisconnect }: TWCSessionCardProps) => {
  const { t } = useTranslation();
  const { name, url, icons } = metadata;
  const accountDetail = useLoad(() => getEthAccountCodeAndNameByAddress(receiveAddress), []);
  const truncatedAddress = truncateAddress(receiveAddress);
  const accountName = accountDetail && accountDetail.success ? accountDetail.name : t('walletConnect.dashboard.unspecifiedAccount');

  return (
    <div className={styles.container}>
      <TextData
        accountName={accountName}
        receiveAddress={truncatedAddress}
        dAppName={name}
        dAppUrl={url}
        iconUrl={icons[0]}
      />
      <div className={styles.buttonAndIconContainer}>
        <img className="show-on-small" src={icons[0]} alt="logo" />
        <Button className={styles.buttonDisconnect} onClick={onDisconnect} danger>
          {t('settings.electrum.remove-server')}
        </Button>
      </div>
    </div>
  );
};
