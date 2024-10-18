/**
 * Copyright 2024 Shift Crypto AG
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

import { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccountCode, IAccount } from '@/api/account';
import { hasMobileChannel, TDevices } from '@/api/devices';
import { getDeviceInfo } from '@/api/bitbox01';
import { RatesContext } from '@/contexts/RatesContext';
import { findAccount, isBitcoinBased } from '@/routes/account/utils';
import { alertUser } from '@/components/alert/Alert';
import { Send } from './send';

type TSendProps = {
    accounts: IAccount[];
    code: AccountCode;
    devices: TDevices;
    deviceIDs: string[];
}

export const SendWrapper = ({ accounts, code, deviceIDs, devices }: TSendProps) => {
  const { t } = useTranslation();
  const { defaultCurrency } = useContext(RatesContext);

  const [bb01Paired, setBB01Paired] = useState<boolean>();
  const [noMobileChannelError, setNoMobileChannelError] = useState<boolean>();

  const account = findAccount(accounts, code);
  const product = deviceIDs.length > 0 ? devices[deviceIDs[0]] : undefined;

  useEffect(() => {
    if (account && product && product === 'bitbox') {
      const fetchData = async () => {
        try {
          const mobileChannel = await hasMobileChannel(product)();
          const { pairing } = await getDeviceInfo(product);
          setBB01Paired(mobileChannel && pairing);
          setNoMobileChannelError(pairing && !mobileChannel && isBitcoinBased(account.coinCode));
        } catch (error) {
          console.error(error);
        }
      };
      fetchData();
    }
  }, [account, product]);

  if (noMobileChannelError) {
    alertUser(t('warning.sendPairing'));
    return;
  }
  return (
    account ? (
      <Send
        account={account}
        bb01Paired={bb01Paired}
        activeCurrency={defaultCurrency}
      />
    ) : (null)
  );
};
