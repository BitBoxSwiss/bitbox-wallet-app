// SPDX-License-Identifier: Apache-2.0

import { apiGet, apiPost } from '../utils/request';
import { AccountCode, TBalance } from './account';
import { TSubscriptionCallback, subscribeEndpoint } from './subscribe';
import qs from 'query-string';

export interface ILightningResponse<T> {
  success: boolean;
  data?: T;
  errorMessage?: string;
  errorCode?: string;
}

export type TLightningAccountConfig = {
  rootFingerprint: string;
  code: AccountCode;
  num: number;
};

export type TLightningConfig = {
  accounts: TLightningAccountConfig[];
};

// Breez SDK types

export interface LnInvoice {
  bolt11: string;
  description?: string;
  amountMsat?: number;
}

export interface ListPaymentsRequest {
  typeFilter?: PaymentType[];
  statusFilter?: PaymentStatus[];
  fromTimestamp?: number;
  toTimestamp?: number;
  offset?: number;
  limit?: number;
  sortAscending?: boolean;
}

export type NodeState = Record<string, unknown>;

export interface Payment {
  id: string;
  paymentType: PaymentType;
  status: PaymentStatus;
  amountSat: number;
  feesSat: number;
  timestamp: number;
  description?: string;
  paymentHash?: string;
  paymentPreimage?: string;
  invoice?: string;
}

export interface ReceivePaymentRequest {
  amountMsat: number;
  description: string;
}

export interface ReceivePaymentResponse {
  invoice: string;
  fee: number;
}

export interface SendPaymentRequest {
  bolt11: string;
  amountMsat?: number;
}

export enum InputTypeVariant {
  BOLT11 = 'bolt11',
}

export type InputType = {
  type: InputTypeVariant.BOLT11;
  invoice: LnInvoice;
};

enum PaymentMethod {
  LIGHTNING = 1,
  SPARK = 2,
  TOKEN = 3,
  DEPOSIT = 4,
  WITHDRAW = 5,
  UNKNOWN = 6
}

export enum PaymentStatus {
  COMPLETED = 1,
  PENDING = 2,
  FAILED = 3
}

export enum PaymentType {
  SEND = 1,
  RECEIVE = 2
}

// Request types
export interface ParseInputRequest {
  s: string;
}

/**
 *
 */
export class SdkError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.code = code;

    Object.setPrototypeOf(this, SdkError.prototype);
  }
}

/**
 * Generic getApi handler
 * @param url
 * @param defaultError
 * @returns T
 */
const getApiResponse = async <T>(url: string, defaultError: string = 'Error'): Promise<T> => {
  const response: ILightningResponse<T> = await apiGet(url);
  if (!response.success) {
    throw new SdkError(response.errorMessage || defaultError, response.errorCode);
  }
  if (response.data === undefined) {
    throw new SdkError(defaultError, response.errorCode);
  }
  return response.data;
};

/**
 * Generic postApi handler
 * @param url
 * @param data
 * @param defaultError
 * @returns T
 */
const postApiResponse = async <T, C extends object | undefined>(url: string, data: C, defaultError: string = 'Error'): Promise<T> => {
  const response: ILightningResponse<T> = await apiPost(url, data);
  if (!response.success) {
    throw new SdkError(response.errorMessage || defaultError, response.errorCode);
  }
  if (response.data === undefined) {
    return undefined as T;
  }
  return response.data;
};

/**
 * Lightning interface
 */

export const getLightningConfig = async (): Promise<TLightningConfig> => {
  return await apiGet('lightning/config');
};

export const postActivateNode = async (): Promise<void> => {
  return postApiResponse<void, undefined>('lightning/activate-node', undefined, 'Error calling postActivateNode');
};

export const postDeactivateNode = async (): Promise<void> => {
  return postApiResponse<void, undefined>('lightning/deactivate-node', undefined, 'Error calling postDeactivateNode');
};

export const getLightningBalance = async (): Promise<TBalance> => {
  return getApiResponse<TBalance>('lightning/balance', 'Error calling getLightningBalance');
};

/**
 * Breez SDK API interface
 */

type ListPaymentsResponsePayment = {
  Id: string;
  PaymentType: PaymentType;
  Status: PaymentStatus;
  Amount: string | number;
  Fees: string | number;
  Timestamp: number;
  Method: PaymentMethod;
  Details?: ListPaymentsResponsePaymentDetails;
};

type ListPaymentsResponseLightningDetails = {
  Description?: string | null;
  Preimage?: string | null;
  Invoice?: string;
  PaymentHash?: string;
};

type ListPaymentsResponseSparkDetails = {
  InvoiceDetails?: {
    Description?: string | null;
    Invoice?: string;
  };
  HtlcDetails?: {
    PaymentHash?: string;
    Preimage?: string | null;
  };
};

type ListPaymentsResponsePaymentDetails =
  | ListPaymentsResponseLightningDetails
  | ListPaymentsResponseSparkDetails
  | Record<string, unknown>;

const parseAmount = (value?: string | number | null): number => {
  if (typeof value === 'number') {
    return value;
  }
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

type PaymentDetailsInfo = {
  description?: string;
  paymentHash?: string;
  paymentPreimage?: string;
  invoice?: string;
};

const normalizePaymentDetails = (
  method: PaymentMethod,
  details?: ListPaymentsResponsePaymentDetails
): PaymentDetailsInfo | undefined => {
  if (!details) {
    return undefined;
  }

  if (method === PaymentMethod.LIGHTNING) {
    const lightningDetails = details as ListPaymentsResponseLightningDetails;
    return {
      description: lightningDetails.Description || undefined,
      paymentPreimage: lightningDetails.Preimage || undefined,
      invoice: lightningDetails.Invoice,
      paymentHash: lightningDetails.PaymentHash,
    };
  }

  if (method === PaymentMethod.SPARK) {
    const sparkDetails = details as ListPaymentsResponseSparkDetails;
    const htlcDetails = sparkDetails.HtlcDetails;
    return {
      description: sparkDetails.InvoiceDetails?.Description || undefined,
      invoice: sparkDetails.InvoiceDetails?.Invoice,
      paymentHash: htlcDetails?.PaymentHash,
      paymentPreimage: htlcDetails?.Preimage || undefined,
    };
  }

  return undefined;
};

const normalizePayment = (payment: ListPaymentsResponsePayment): Payment => {
  const method = payment.Method ?? PaymentMethod.UNKNOWN;
  const details = normalizePaymentDetails(method, payment.Details);

  return {
    id: payment.Id,
    paymentType: payment.PaymentType ?? PaymentType.SEND,
    status: payment.Status ?? PaymentStatus.PENDING,
    amountSat: parseAmount(payment.Amount),
    feesSat: parseAmount(payment.Fees),
    timestamp: payment.Timestamp,
    description: details?.description,
    paymentHash: details?.paymentHash,
    paymentPreimage: details?.paymentPreimage,
    invoice: details?.invoice,
  };
};

export const getListPayments = async (params: ListPaymentsRequest): Promise<Payment[]> => {
  const payments = await getApiResponse<ListPaymentsResponsePayment[]>(
    `lightning/list-payments?${qs.stringify(params, { skipNull: true })}`,
    'Error calling getListPayments'
  );

  return payments.map(normalizePayment);
};

export const getParseInput = async (params: ParseInputRequest): Promise<InputType> => {
  return getApiResponse<InputType>(`lightning/parse-input?${qs.stringify(params, { skipNull: true })}`, 'Error calling getParseInput');
};

export type TBoardingAddress = {
  address: string;
  fee: number;
};

export const getBoardingAddress = async (): Promise<TBoardingAddress> => {
  return getApiResponse<TBoardingAddress>('lightning/boarding-address', 'Error calling getBoardingAddress');
};

export const postSendPayment = async (data: SendPaymentRequest): Promise<void> => {
  return postApiResponse<void, SendPaymentRequest>('lightning/send-payment', data, 'Error calling postSendPayment');
};

export const postReceivePayment = async (data: ReceivePaymentRequest): Promise<ReceivePaymentResponse> => {
  return postApiResponse<ReceivePaymentResponse, ReceivePaymentRequest>(
    'lightning/receive-payment',
    data,
    'Error calling postReceivePayment'
  );
};

/**
 * Subscriptions
 */

/**
 * Returns a function that subscribes a callback on a "lightning/config"
 * event to notify when a change to the lightning config has occurred.
 * Meant to be used with `useSubscribe`.
 */
export const subscribeLightningConfig = (cb: TSubscriptionCallback<TLightningConfig>) => {
  return subscribeEndpoint('lightning/config', cb);
};

/**
 * Returns a function that subscribes a callback on a "lightning/list-payments"
 * event to notify when a change to the payments list has occurred.
 * Meant to be used with `useSubscribe`.
 */
export const subscribeListPayments = (cb: TSubscriptionCallback<Payment[]>) => {
  return subscribeEndpoint('lightning/list-payments', cb);
};

/**
 * Returns a function that subscribes a callback on a "lightning/node-state"
 * event to receive the latest state of the lightning node.
 * Meant to be used with `useSubscribe`.
 */
export const subscribeNodeState = (cb: TSubscriptionCallback<NodeState>) => {
  return subscribeEndpoint('lightning/node-info', cb);
};
