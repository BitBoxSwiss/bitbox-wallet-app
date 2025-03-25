/**
 * Copyright 2023 Shift Crypto AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { WalletConnectDefaultLogo } from '@/components/icon';
import { truncateAddress } from '@/utils/walletconnect';
import styles from './header.module.css';

type TWalletConnectProps = {
  receiveAddress: string;
  accountName: string;
};

export const WCHeader = ({
  receiveAddress,
  accountName,
}: TWalletConnectProps) => {
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
