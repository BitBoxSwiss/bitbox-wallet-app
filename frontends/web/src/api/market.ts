// SPDX-License-Identifier: Apache-2.0

import type { AccountCode } from './account';
import { apiGet, apiPost } from '@/utils/request';

export const getMarketRegionCodes = (): Promise<string[]> => {
  return apiGet('market/region-codes');
};

export type TPaymentMethod = 'card' | 'bank-transfer' | 'bancontact' | 'sofort';

export type TMarketDeal = {
  fee: number;
  payment?: TPaymentMethod;
  isFast?: boolean;
  isBest?: boolean;
  isHidden?: boolean;
};

export type TVendorName = 'moonpay' | 'pocket' | 'btcdirect' | 'btcdirect-otc' | 'bitrefill' | 'swapkit';

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

export type TMarketAction = 'buy' | 'sell' | 'spend' | 'swap' | 'otc';

export const getMarketDeals = (
  action: TMarketAction,
  accountCode: AccountCode,
  region: string,
): Promise<TMarketDealsResponse> => {
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
