// SPDX-License-Identifier: Apache-2.0

import type { AccountCode, TAmountWithConversions, TBalance, TTransactionStatus } from '@/api/account';
import type { TSubscriptionCallback, TUnsubscribe } from '@/api/subscribe';
import { subscribeEndpoint } from '@/api/subscribe';
import { apiGet, apiPost } from '@/utils/request';
import { type TLightningErrorCode, TSdkError } from './lightning-errors';

export type TLightningResponse<T> =
  | {
    success: true;
    data: T;
  }
  | {
    success: false;
    errorMessage?: string;
    errorCode?: TLightningErrorCode;
  };

export type TLightningAccount = {
  rootFingerprint: string;
  code: AccountCode;
  num: number;
};

export type TLightningBolt11Invoice = {
  invoice: string;
  description?: string;
  amountSat?: number;
};

export type TLightningLNURLPay = {
  input: string;
  address?: string;
  domain: string;
  description?: string;
  minAmountSat: number;
  maxAmountSat: number;
};

export type TLightningPayment = {
  id: string;
  type: 'send' | 'receive';
  status: TTransactionStatus;
  time: string | null;
  description?: string;
  amount: TAmountWithConversions;
  amountAtTime: TAmountWithConversions;
  deductedAmountAtTime: TAmountWithConversions;
  fee: TAmountWithConversions;
  invoice?: string;
};

export type TReceivePaymentRequest = {
  amountSat: number;
  description: string;
};

export type TReceivePaymentResponse = {
  invoice: string;
};

export type TCloseWithdrawQuote = {
  balance: TAmountWithConversions;
  balanceSat: number;
  fee: TAmountWithConversions;
  feeSat: number;
};

export type TCloseWithdrawResult = {
  txId?: string;
  walletClosed: boolean;
};

export type TLightningAddressAvailability = {
  username: string;
  address: string;
  available: boolean;
};

export type TGeneratedLightningAddress = {
  username: string;
  address: string;
};

export type TSendPaymentRequest = {
  type: TPaymentInputType.BOLT11;
  paymentInput: string;
  amountSat?: number;
  approvedFeeSat: number;
} | {
  type: TPaymentInputType.LNURL_PAY;
  paymentInput: string;
  amountSat: number;
  approvedFeeSat: number;
};

export type TPreparePaymentRequest = {
  type: TPaymentInputType.BOLT11;
  paymentInput: string;
  amountSat?: number;
} | {
  type: TPaymentInputType.LNURL_PAY;
  paymentInput: string;
  amountSat: number;
};

export type TPreparePaymentResponse = {
  amountSat: number;
  feeSat: number;
  totalDebitSat: number;
};

export type TServiceStatus = 'operational' | 'degraded' | 'partial' | 'major' | 'unknown';

export type TSparkStatus = {
  status: TServiceStatus;
};

export enum TPaymentInputType {
  BOLT11 = 'bolt11',
  LNURL_PAY = 'lnurlPay',
}

export type TPaymentInput = {
  type: TPaymentInputType.BOLT11;
  invoice: TLightningBolt11Invoice;
} | {
  type: TPaymentInputType.LNURL_PAY;
  lnurlPay: TLightningLNURLPay;
};

export type TParsePaymentInputRequest = {
  s: string;
};

const queryString = (params: Record<string, string | number | undefined | null>): string => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.set(key, String(value));
    }
  });
  return searchParams.toString();
};

const getApiResponse = async <T>(url: string, defaultError: string = 'Error'): Promise<T> => {
  const response: TLightningResponse<T> = await apiGet(url);
  if (!response.success) {
    throw new TSdkError(response.errorMessage || defaultError, response.errorCode);
  }
  if (response.data === undefined) {
    throw new TSdkError(defaultError);
  }
  return response.data;
};

const postApiResponse = async <T, C extends object | undefined>(url: string, data: C, defaultError: string = 'Error'): Promise<T> => {
  const response: TLightningResponse<T> = await apiPost(url, data);
  if (!response.success) {
    throw new TSdkError(response.errorMessage || defaultError, response.errorCode);
  }
  if (response.data === undefined) {
    return undefined as T;
  }
  return response.data;
};

export const getLightningAccount = async (): Promise<TLightningAccount | null> => {
  return apiGet('lightning/account');
};

export const getLightningAddress = async (): Promise<string | null> => {
  return getApiResponse<string | null>('lightning/address', 'Error calling getLightningAddress');
};

export const getLightningAddressDomain = async (): Promise<string> => {
  return getApiResponse<string>('lightning/address/domain', 'Error calling getLightningAddressDomain');
};

export const getLightningAddressAvailability = async (username: string): Promise<TLightningAddressAvailability> => {
  return getApiResponse<TLightningAddressAvailability>(
    `lightning/address/availability?${queryString({ username })}`,
    'Error calling getLightningAddressAvailability'
  );
};

export const postGenerateLightningAddress = async (): Promise<TGeneratedLightningAddress> => {
  return postApiResponse<TGeneratedLightningAddress, undefined>(
    'lightning/address/generate',
    undefined,
    'Error calling postGenerateLightningAddress'
  );
};

export const postRegisterLightningAddress = async (username: string): Promise<string> => {
  return postApiResponse<string, { username: string }>(
    'lightning/address/register',
    { username },
    'Error calling postRegisterLightningAddress'
  );
};

export const getLightningReady = async (): Promise<boolean> => {
  return getApiResponse<boolean>('lightning/ready', 'Error calling getLightningReady');
};

export const postActivate = async (): Promise<void> => {
  return postApiResponse<void, undefined>('lightning/activate', undefined, 'Error calling postActivate');
};

export const postDeactivate = async (): Promise<void> => {
  return postApiResponse<void, undefined>('lightning/deactivate', undefined, 'Error calling postDeactivate');
};

export const getLightningBalance = async (): Promise<TBalance> => {
  return getApiResponse<TBalance>('lightning/balance', 'Error calling getLightningBalance');
};

export const getSparkStatus = async (): Promise<TSparkStatus> => {
  return getApiResponse<TSparkStatus>('lightning/spark-status', 'Error calling getSparkStatus');
};

export const getListPayments = async (): Promise<TLightningPayment[]> => {
  return getApiResponse<TLightningPayment[]>('lightning/list-payments', 'Error calling getListPayments');
};

export const getParsePaymentInput = async (params: TParsePaymentInputRequest): Promise<TPaymentInput> => {
  return getApiResponse<TPaymentInput>(`lightning/parse-payment-input?${queryString(params)}`, 'Error calling getParsePaymentInput');
};

export const getBoardingAddress = async (): Promise<string> => {
  return getApiResponse<string>('lightning/boarding-address', 'Error calling getBoardingAddress');
};

export const postPrepareCloseWithdraw = async (destinationAddress: string): Promise<TCloseWithdrawQuote> => {
  return postApiResponse<TCloseWithdrawQuote, { destinationAddress: string }>(
    'lightning/close-withdraw-funds/prepare',
    { destinationAddress },
    'Error calling postPrepareCloseWithdraw'
  );
};

export const postCloseWithdraw = async (
  destinationAddress: string,
  approvedBalanceSat: number,
  approvedFeeSat: number,
): Promise<TCloseWithdrawResult> => {
  return postApiResponse<TCloseWithdrawResult, {
    destinationAddress: string;
    approvedBalanceSat: number;
    approvedFeeSat: number;
  }>(
    'lightning/close-withdraw-funds',
    { destinationAddress, approvedBalanceSat, approvedFeeSat },
    'Error calling postCloseWithdraw'
  );
};

export const postPreparePayment = async (data: TPreparePaymentRequest): Promise<TPreparePaymentResponse> => {
  return postApiResponse<TPreparePaymentResponse, TPreparePaymentRequest>(
    'lightning/prepare-payment',
    data,
    'Error calling postPreparePayment'
  );
};

export const postSendPayment = async (data: TSendPaymentRequest): Promise<void> => {
  return postApiResponse<void, TSendPaymentRequest>('lightning/send-payment', data, 'Error calling postSendPayment');
};

export const getReceivePayment = async (params: TReceivePaymentRequest): Promise<TReceivePaymentResponse> => {
  return getApiResponse<TReceivePaymentResponse>(`lightning/receive-payment?${queryString(params)}`, 'Error calling getReceivePayment');
};

export const subscribeLightningAccount = (cb: TSubscriptionCallback<TLightningAccount | null>): TUnsubscribe => {
  return subscribeEndpoint('lightning/account', cb);
};

export const subscribeLightningAddress = (cb: TSubscriptionCallback<string | null>): TUnsubscribe => {
  return subscribeEndpoint('lightning/address', cb);
};

export const subscribeLightningReady = (cb: TSubscriptionCallback<boolean>): TUnsubscribe => {
  return subscribeEndpoint('lightning/ready', cb);
};

export const subscribeListPayments = (cb: TSubscriptionCallback<TLightningPayment[]>) => {
  return subscribeEndpoint('lightning/list-payments', cb);
};
