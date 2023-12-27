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

export type ExchangeRegionList = {
  regions: ExchangeRegion[];
}

export type ExchangeRegion = {
  code: string;
  isMoonpayEnabled: boolean;
  isPocketEnabled: boolean;
}

export const getExchangesByRegion = (code: string) => {
  return (): Promise<ExchangeRegionList> => {
    return apiGet(`exchange/by-region/${code}`);
  };
};

export type ExchangeDeal = {
  fee: number;
  payment: 'card' | 'bank-transfer';
  isFast: boolean;
}

export type ExchangeDeals = {
  exchangeName: 'moonpay' | 'pocket';
  deals: ExchangeDeal[];
}

export type ExchangeDealsList = {
  exchanges: ExchangeDeals[];
}

export const getExchangeDeals = (): Promise<ExchangeDealsList> => {
  return apiGet('exchange/deals');
};

export type MoonpayBuyInfo = {
  url: string;
  address: string;
}

export const getMoonpayBuyInfo = (code: AccountCode) => {
  return (): Promise<MoonpayBuyInfo> => {
    return apiGet(`exchange/moonpay/buy-info/${code}`);
  };
};

export type ExchangeErrorCode = 'userAbort' | 'addressNotFound';

export type AddressSignResponse = {
  success: boolean;
  signature: string;
  address: string;
  errorMessage?: string;
  errorCode?: ExchangeErrorCode;
}


export const signAddress = (format: string, msg: string, accountCode: AccountCode): Promise<AddressSignResponse> => {
  return apiPost('exchange/pocket/sign-address', { format, msg, accountCode });
};

export type AddressVerificationResponse = {
  success: boolean;
  errorMessage?: string;
  errorCode?: ExchangeErrorCode;
}

export const verifyAddress = (address: string, accountCode: AccountCode): Promise<AddressVerificationResponse> => {
  return apiPost('exchange/pocket/verify-address', { address, accountCode });
};

export const getPocketURL = (): Promise<string> => {
  return apiGet('exchange/pocket/api-url');
};

export type SupportedExchanges= {
  exchanges: string[];
};

export const getExchangeBuySupported = (code: AccountCode) => {
  return (): Promise<SupportedExchanges> => {
    return apiGet(`exchange/buy-supported/${code}`);
  };
};
