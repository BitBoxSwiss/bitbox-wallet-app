// SPDX-License-Identifier: Apache-2.0

import { apiGet, apiPost } from '../utils/request';
import { AccountCode, TBalance, TTransactionStatus } from './account';
import { TSubscriptionCallback, TUnsubscribe, subscribeEndpoint } from './subscribe';

export type TLightningResponse<T> =
  | {
    success: true;
    data: T;
  }
  | {
    success: false;
    errorMessage?: string;
    errorCode?: string;
  };

export type TLightningAccount = {
  rootFingerprint: string;
  code: AccountCode;
  num: number;
};

export type TLightningInvoice = {
  bolt11: string;
  description?: string;
  amountSat?: number;
};

export type TLightningPayment = {
  id: string;
  type: 'send' | 'receive';
  status: TTransactionStatus;
  amountSat: number;
  feesSat: number;
  timestamp: number;
  description?: string;
  paymentHash?: string;
  paymentPreimage?: string;
  invoice?: string;
};

export type TReceivePaymentRequest = {
  amountSat: number;
  description: string;
};

export type TReceivePaymentResponse = {
  invoice: string;
};

export type TSendPaymentRequest = {
  bolt11: string;
  amountSat?: number;
};

export enum TInputTypeVariant {
  BOLT11 = 'bolt11',
}

export type TInputType = {
  type: TInputTypeVariant.BOLT11;
  invoice: TLightningInvoice;
};

export type TParsePaymentInputRequest = {
  s: string;
};

export class TSdkError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.code = code;

    Object.setPrototypeOf(this, TSdkError.prototype);
  }
}

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

export const postActivate = async (): Promise<void> => {
  return postApiResponse<void, undefined>('lightning/activate', undefined, 'Error calling postActivate');
};

export const postDeactivate = async (): Promise<void> => {
  return postApiResponse<void, undefined>('lightning/deactivate', undefined, 'Error calling postDeactivate');
};

export const getLightningBalance = async (): Promise<TBalance> => {
  return getApiResponse<TBalance>('lightning/balance', 'Error calling getLightningBalance');
};

export const getListPayments = async (): Promise<TLightningPayment[]> => {
  return getApiResponse<TLightningPayment[]>('lightning/list-payments', 'Error calling getListPayments');
};

export const getParsePaymentInput = async (params: TParsePaymentInputRequest): Promise<TInputType> => {
  return getApiResponse<TInputType>(`lightning/parse-payment-input?${queryString(params)}`, 'Error calling getParsePaymentInput');
};

export const getBoardingAddress = async (): Promise<string> => {
  return getApiResponse<string>('lightning/boarding-address', 'Error calling getBoardingAddress');
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

export const subscribeListPayments = (cb: TSubscriptionCallback<TLightningPayment[]>) => {
  return subscribeEndpoint('lightning/list-payments', cb);
};
