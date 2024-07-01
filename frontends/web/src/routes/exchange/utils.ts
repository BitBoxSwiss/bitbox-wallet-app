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

import { FrontendExchangeDealsList, Info } from './types';
import { IAccount } from '../../api/account';
import { getExchangeBuySupported, getExchangeSellSupported } from '../../api/exchanges';

/**
 * Finds the lowest fee among all `supported`
 * exchange providers for a given region.
 */
export const findLowestFee = (providers: FrontendExchangeDealsList) => {
  // all payment methods' fees of all
  // supported providers (for a selected region)
  let allFees: number[] = [];

  providers.exchanges.forEach(provider => {
    provider.deals.forEach(deal => {
      if (provider.supported) {
        allFees = [...allFees, deal.fee];
      }
    });
  });

  return Math.min(...allFees);
};

export const findBestDeal = (
  providers: FrontendExchangeDealsList,
  lowestFee: number,
): FrontendExchangeDealsList => {
  // for each provider's payment method
  // mark it as "bestDeal" if the
  // fee is equal to the lowest fee
  // accross ALL supported providers
  const hasMultipleSupportedExchanges = providers.exchanges.filter(p => p.supported).length > 1;
  const exchanges = providers.exchanges.map(exchange => ({
    ...exchange,
    deals: exchange.deals.map(deal => ({
      ...deal,
      isBestDeal: deal.fee === lowestFee && hasMultipleSupportedExchanges
    }))
  }));
  return { exchanges };
};

/**
 * Gets formatted name for exchange.
 */
export const getFormattedName = (name: Omit<Info, 'region'>) => {
  switch (name) {
  case 'moonpay':
    return 'MoonPay';
  case 'pocket':
    return 'Pocket';
  }
};

/**
 * Filters a given accounts list, keeping only the accounts supported by at least one exchange.
 */
export const getExchangeSupportedAccounts = async (accounts: IAccount[]): Promise<IAccount[]> => {
  const accountsWithFalsyValue = await Promise.all(
    accounts.map(async (account) => {
      const supported = await getExchangeBuySupported(account.code)();
      return supported.exchanges.length ? account : false;
    })
  );
  return accountsWithFalsyValue.filter(result => result) as IAccount[];
};


/**
 * Filters a given accounts list, keeping only the accounts supported by at least one exchange for selling.
 */
export const getSellExchangeSupportedAccounts = async (accounts: IAccount[]): Promise<IAccount[]> => {
  const accountsWithFalsyValue = await Promise.all(
    accounts.map(async (account) => {
      //TODO: Remove the Promise.resolve mock and only use getExchangeSellSupported once BE is ready
      const supported = account.coinCode !== 'btc' && account.coinCode !== 'tbtc' ? await Promise.resolve({ exchanges: [] }) : await getExchangeSellSupported();
      return supported.exchanges.length ? account : false;
    })
  );
  return accountsWithFalsyValue.filter(result => result) as IAccount[];
};
