/**
 * Copyright 2022 Shift Crypto AG
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

import { AccountCode } from './account';
import { apiGet, apiPost } from '../utils/request';

export type AddressSignResponse = {
  success: boolean;
  abort: boolean;
  signature: string;
  address: string;
  error: string;
}
export type ExchangeRegionList = {
  regions: ExchangeRegion[];
}

export type ExchangeRegion = {
  code: string;
  isMoonpayEnabled: boolean;
  isPocketEnabled: boolean;
}

export type ExchangeDeal = {
  fee: number;
  payment: 'card' | 'bank-transfer';
  isFast: boolean;
}

export type ExchangeDeals = {
  pocket: ExchangeDeal[];
  moonpay: ExchangeDeal[];
}

export const getExchangesByRegion = (): Promise<ExchangeRegionList> => {
  return apiGet('exchange/by-region');
};

export const getExchangeDeals = (): Promise<ExchangeDeals> => {
  return apiGet('exchange/deals');
};

export const isMoonpayBuySupported = (code: string) => {
  return (): Promise<boolean> => {
    return apiGet(`exchange/moonpay/buy-supported/${code}`);
  };
};

export type MoonpayBuyInfo = {
  url: string;
  address: string;
}

export const getMoonpayBuyInfo = (code: string) => {
  return (): Promise<MoonpayBuyInfo> => {
    return apiGet(`exchange/moonpay/buy-info/${code}`);
  };
};

export const signAddress = (format: string, msg: string, accountCode: AccountCode): Promise<AddressSignResponse> => {
  return apiPost('exchange/pocket/sign-address', { format, msg, accountCode });
};

export const getPocketURL = (accountCode: string) => {
  return (): Promise<string> => {
    return apiGet(`exchange/pocket/api-url/${accountCode}`);
  };
};

export const isPocketSupported = (accountCode: string) => {
  return (): Promise<boolean> => {
    return apiGet(`exchange/pocket/buy-supported/${accountCode}`);
  };
};

export const isExchangeBuySupported = (code: string): Promise<boolean> => {
  return apiGet(`exchange/buy-supported/${code}`);
};
