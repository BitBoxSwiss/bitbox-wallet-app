// SPDX-License-Identifier: Apache-2.0

import { WalletConnectDefaultLogo } from '@/components/icon';
import { truncateAddress } from '@/utils/walletconnect';
import styles from './header.module.css';

type TWalletConnectProps = {
  receiveAddress: string;
  accountName: string;
};

export const WCHeader = ({ receiveAddress, accountName }: TWalletConnectProps) => {
  const displayedReceiveAddress = truncateAddress(receiveAddress);
  return (
    <div className={styles.headerContainer}>
      <WalletConnectDefaultLogo />
      <h1>WalletConnect</h1>
      <p className={styles.accountName}>{accountName}</p>
      <p className={styles.receiveAddress}>{displayedReceiveAddress}</p>
    </div>
  );
};
