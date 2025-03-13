/**
 * Copyright 2022-2024 Shift Crypto AG
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

import { IAccount } from '@/api/account';
import { getExchangeSupported, TExchangeName } from '@/api/exchanges';

/**
 * Gets formatted name for exchange.
 */
export const getExchangeFormattedName = (
  name: TExchangeName,
) => {
  switch (name) {
  case 'moonpay':
    return 'MoonPay';
  case 'pocket':
    return 'Pocket';
  case 'btcdirect':
    return 'BTC Direct';
  case 'btcdirect-otc':
    return 'BTC Direct\'s Private Trading Desk';
  case 'bitrefill':
    return 'Bitrefill';
  }
};

/**
 * Filters a given accounts list, keeping only the accounts supported by at least one exchange.
 */
export const getExchangeSupportedAccounts = async (accounts: IAccount[]): Promise<IAccount[]> => {
  const accountsWithFalsyValue = await Promise.all(
    accounts.map(async (account) => {
      const supported = await getExchangeSupported(account.code)();
      return supported.exchanges.length ? account : false;
    })
  );
  return accountsWithFalsyValue.filter(result => result) as IAccount[];
};
