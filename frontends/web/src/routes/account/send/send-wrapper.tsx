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

import { useContext } from 'react';
import { AccountCode, IAccount } from '@/api/account';
import { TDevices } from '@/api/devices';
import { RatesContext } from '@/contexts/RatesContext';
import { findAccount } from '@/routes/account/utils';
import { Send } from './send';

type TSendProps = {
    accounts: IAccount[];
    code: AccountCode;
    devices: TDevices;
    deviceIDs: string[];
}

export const SendWrapper = ({ accounts, code, deviceIDs, devices }: TSendProps) => {
  const { defaultCurrency } = useContext(RatesContext);
  const account = findAccount(accounts, code);
  return (
    account ? (
      <Send
        account={account}
        devices={devices}
        deviceIDs={deviceIDs}
        activeCurrency={defaultCurrency}
      />
    ) : (null)
  );
};
