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
import { apiGet, apiPost } from '@/utils/request';

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
  payment: 'card' | 'bank-transfer' | 'sofort' | 'bancontact';
  isFast: boolean;
  isBest: boolean;
  isHidden: boolean;
}

export type TExchangeName = 'moonpay' | 'pocket' | 'btcdirect' | 'btcdirect-otc';

export type ExchangeDeals = {
  exchangeName: TExchangeName;
  deals: ExchangeDeal[];
}

export type ExchangeDealsList = {
  exchanges: ExchangeDeals[];
  success: true;
}

export type ExchangeError = {
  success: false;
  errorCode?: 'coinNotSupported' | 'regionNotSupported';
  errorMessage?: string;
}

export type TExchangeDealsResponse = ExchangeDealsList | ExchangeError

export type TExchangeAction = 'buy' | 'sell';

export const getExchangeDeals = (action: TExchangeAction, accountCode: AccountCode, region: ExchangeRegion['code']): Promise<TExchangeDealsResponse> => {
  return apiGet(`exchange/deals/${action}/${accountCode}?region=${region}`);
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

export type AddressVerificationResponse = {
  success: boolean;
  errorMessage?: string;
  errorCode?: 'addressNotFound' | 'userAbort';
}

export const verifyAddress = (address: string, accountCode: AccountCode): Promise<AddressVerificationResponse> => {
  return apiPost('exchange/pocket/verify-address', { address, accountCode });
};

export type TPocketUrlResponse = {
  success: true;
  url: string;
} | {
  success: false;
  errorMessage: string;
};

export const getPocketURL = (action: TExchangeAction): Promise<TPocketUrlResponse> => {
  return apiGet(`exchange/pocket/api-url/${action}`);
};

export type TBTCDirectInfoResponse = {
  success: true;
  url: string;
  apiKey: string;
  address?: string;
} | {
  success: false;
  errorMessage: string;
};

export const getBTCDirectInfo = (
  action: TExchangeAction,
  code: string,
): Promise<TBTCDirectInfoResponse> => {
  return apiGet(`exchange/btcdirect/info/${action}/${code}`);
};

export type SupportedExchanges= {
  exchanges: string[];
};

export const getExchangeSupported = (code: AccountCode) => {
  return (): Promise<SupportedExchanges> => {
    return apiGet(`exchange/supported/${code}`);
  };
};

export type TBtcDirectResponse = {
  success: true;
  supported: boolean;
} | {
  success: false;
};

export const getBtcDirectOTCSupported = (code: AccountCode, region: ExchangeRegion['code']) => {
  return (): Promise<TBtcDirectResponse> => {
    return apiGet(`exchange/btcdirect-otc/supported/${code}?region=${region}`);
  };
};
