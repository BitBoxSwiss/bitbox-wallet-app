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

import type { AccountCode } from './account';
import { apiGet, apiPost } from '@/utils/request';

export const getMarketRegionCodes = (): Promise<string[]> => {
  return apiGet('market/region-codes');
};

export type TPaymentMethod = 'card' | 'bank-transfer' | 'bancontact' | 'sofort';

export type TMarketDeal = {
  fee: number;
  payment?: TPaymentMethod;
  isFast: boolean;
  isBest: boolean;
  isHidden: boolean;
};

export type TVendorName = 'moonpay' | 'pocket' | 'btcdirect' | 'btcdirect-otc' | 'bitrefill';

export type TMarketDeals = {
  vendorName: TVendorName;
  deals: TMarketDeal[];
};

export type TMarketDealsList = {
  deals: TMarketDeals[];
  success: true;
};

export type TMarketError = {
  success: false;
  errorCode?: 'coinNotSupported' | 'regionNotSupported';
  errorMessage?: string;
};

export type TMarketDealsResponse = TMarketDealsList | TMarketError;

export type TMarketAction = 'buy' | 'sell' | 'spend';

export const getMarketDeals = (action: TMarketAction, accountCode: AccountCode, region: string): Promise<TMarketDealsResponse> => {
  return apiGet(`market/deals/${action}/${accountCode}?region=${region}`);
};

export type MoonpayBuyInfo = {
  url: string;
  address: string;
};

export const getMoonpayBuyInfo = (code: AccountCode) => {
  return (): Promise<MoonpayBuyInfo> => {
    return apiGet(`market/moonpay/buy-info/${code}`);
  };
};

export type AddressVerificationResponse = {
  success: boolean;
  errorMessage?: string;
  errorCode?: 'addressNotFound' | 'userAbort';
};

export const verifyAddress = (address: string, accountCode: AccountCode): Promise<AddressVerificationResponse> => {
  return apiPost('market/pocket/verify-address', { address, accountCode });
};

export type TPocketUrlResponse = {
  success: true;
  url: string;
} | {
  success: false;
  errorMessage: string;
};

export const getPocketURL = (action: TMarketAction): Promise<TPocketUrlResponse> => {
  return apiGet(`market/pocket/api-url/${action}`);
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

export const getBTCDirectInfo = async (action: TMarketAction, code: string): Promise<TBTCDirectInfoResponse> => {
  return apiGet(`market/btcdirect/info/${action}/${code}`);
};

export type TBitrefillInfoResponse = {
  success: true;
  url: string;
  ref: string;
  address?: string;
} | {
  success: false;
  errorMessage: string;
};

export const getBitrefillInfo = (
  action: TMarketAction,
  code: string,
): Promise<TBitrefillInfoResponse> => {
  return apiGet(`market/bitrefill/info/${action}/${code}`);
};

export type MarketVendors= {
  vendors: string[];
};

export const getMarketVendors = (code: AccountCode) => {
  return (): Promise<MarketVendors> => {
    return apiGet(`market/vendors/${code}`);
  };
};

export type TBtcDirectResponse = {
  success: true;
  supported: boolean;
} | {
  success: false;
};

export const getBtcDirectOTCSupported = (code: AccountCode, region: string) => {
  return (): Promise<TBtcDirectResponse> => {
    return apiGet(`market/btcdirect-otc/supported/${code}?region=${region}`);
  };
};
