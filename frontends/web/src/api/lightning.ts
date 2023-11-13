/**
 * Copyright 2021 Shift Crypto AG
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

import { apiGet, apiPost } from '../utils/request';
import { TSubscriptionCallback, subscribeEndpoint } from './subscribe';
import qs from 'query-string';

export interface ILightningResponse<T> {
  success: boolean;
  data: T;
  errorMessage?: string;
  errorCode?: string;
}

export type LightningConfig = {
  inactive: boolean;
};

export type NodeSetup = {
  entropy: string;
};

// Breez SDK types

export type AesSuccessActionDataDecrypted = {
  description: string;
  plaintext: string;
};

export type BackupFailedData = {
  error: string;
};

export type BackupStatus = {
  backedUp: boolean;
  lastBackupTime?: number;
};

export type BitcoinAddressData = {
  address: string;
  network: Network;
  amountSat?: number;
  label?: string;
  message?: string;
};

export type BuyBitcoinRequest = {
  provider: BuyBitcoinProvider;
  openingFeeParams?: OpeningFeeParams;
};

export type BuyBitcoinResponse = {
  url: string;
  openingFeeParams?: OpeningFeeParams;
};

export type CheckMessageRequest = {
  message: string;
  pubkey: string;
  signature: string;
};

export type CheckMessageResponse = {
  isValid: boolean;
};

export type ClosedChannelPaymentDetails = {
  shortChannelId: string;
  state: ChannelState;
  fundingTxid: string;
  closingTxid?: string;
};

export type Config = {
  breezserver: string;
  mempoolspaceUrl: string;
  workingDir: string;
  network: Network;
  paymentTimeoutSec: number;
  defaultLspId?: string;
  apiKey?: string;
  maxfeePercent: number;
  exemptfeeMsat: number;
  nodeConfig: NodeConfig;
};

export type CurrencyInfo = {
  name: string;
  fractionSize: number;
  spacing?: number;
  symbol?: SymbolType;
  uniqSymbol?: SymbolType;
  localizedName?: LocalizedName[];
  localeOverrides?: LocaleOverrides[];
};

export type FiatCurrency = {
  id: string;
  info: CurrencyInfo;
};

export type GreenlightCredentials = {
  deviceKey: number[];
  deviceCert: number[];
};

export type GreenlightNodeConfig = {
  partnerCredentials?: GreenlightCredentials;
  inviteCode?: string;
};

export type InvoicePaidDetails = {
  paymentHash: string;
  bolt11: string;
};

export type LnInvoice = {
  bolt11: string;
  payeePubkey: string;
  paymentHash: string;
  description?: string;
  descriptionHash?: string;
  amountMsat?: number;
  timestamp: number;
  expiry: number;
  routingHints: RouteHint[];
  paymentSecret: number[];
};

export type ListPaymentsRequest = {
  filter: PaymentTypeFilter;
  fromTimestamp?: number;
  toTimestamp?: number;
  includeFailures?: boolean;
  offset?: number;
  limit?: number;
};

export type LnPaymentDetails = {
  paymentHash: string;
  label: string;
  destinationPubkey: string;
  paymentPreimage: string;
  keysend: boolean;
  bolt11: string;
  lnurlSuccessAction?: SuccessActionProcessed;
  lnurlMetadata?: string;
  lnAddress?: string;
  lnurlWithdrawEndpoint?: string;
};

export type LnUrlAuthRequestData = {
  k1: string;
  action?: string;
  domain: string;
  url: string;
};

export type LnUrlErrorData = {
  reason: string;
};

export type LnUrlPayRequest = {
  data: LnUrlPayRequestData;
  amountMsat: number;
  comment?: string;
};

export type LnUrlPayRequestData = {
  callback: string;
  minSendable: number;
  maxSendable: number;
  metadataStr: string;
  commentAllowed: number;
  domain: string;
  lnAddress?: string;
};

export type LnUrlWithdrawRequest = {
  data: LnUrlWithdrawRequestData;
  amountMsat: number;
  description?: string;
};

export type LnUrlWithdrawRequestData = {
  callback: string;
  k1: string;
  defaultDescription: string;
  minWithdrawable: number;
  maxWithdrawable: number;
};

export type LnUrlWithdrawSuccessData = {
  invoice: LnInvoice;
};

export type LocaleOverrides = {
  locale: string;
  spacing?: number;
  symbol: SymbolType;
};

export type LocalizedName = {
  locale: string;
  name: string;
};

export type LogEntry = {
  line: string;
  level: string;
};

export type LspInformation = {
  id: string;
  name: string;
  widgetUrl: string;
  pubkey: string;
  host: string;
  channelCapacity: number;
  targetConf: number;
  baseFeeMsat: number;
  feeRate: number;
  timeLockDelta: number;
  minHtlcMsat: number;
  lspPubkey: number[];
  openingFeeParamsList: OpeningFeeParamsMenu;
};

export type MessageSuccessActionData = {
  message: string;
};

export type MetadataItem = {
  key: string;
  value: string;
};

export type NodeState = {
  id: string;
  blockHeight: number;
  channelsBalanceMsat: number;
  onchainBalanceMsat: number;
  utxos: UnspentTransactionOutput[];
  maxPayableMsat: number;
  maxReceivableMsat: number;
  maxSinglePaymentAmountMsat: number;
  maxChanReserveMsats: number;
  connectedPeers: string[];
  inboundLiquidityMsats: number;
};

export type OpenChannelFeeRequest = {
  amountMsat: number;
  expiry?: number;
};

export type OpenChannelFeeResponse = {
  feeMsat: number;
  usedFeeParams?: OpeningFeeParams;
};

export type OpeningFeeParams = {
  minMsat: number;
  proportional: number;
  validUntil: string;
  maxIdleTime: number;
  maxClientToSelfDelay: number;
  promise: string;
};

export type OpeningFeeParamsMenu = {
  values: OpeningFeeParams[];
};

export type Payment = {
  id: string;
  paymentType: PaymentType;
  paymentTime: number;
  amountMsat: number;
  feeMsat: number;
  status: PaymentStatus;
  description?: string;
  details: PaymentDetails;
};

export type PaymentFailedData = {
  error: string;
  nodeId: string;
  invoice?: LnInvoice;
};

export type Rate = {
  coin: string;
  value: number;
};

export type ReceiveOnchainRequest = {
  openingFeeParams?: OpeningFeeParams;
};

export type ReceivePaymentRequest = {
  amountMsat: number;
  description: string;
  preimage?: number[];
  openingFeeParams?: OpeningFeeParams;
  useDescriptionHash?: boolean;
  expiry?: number;
  cltv?: number;
};

export type ReceivePaymentResponse = {
  lnInvoice: LnInvoice;
  openingFeeParams?: OpeningFeeParams;
  openingFeeMsat?: number;
};

export type RecommendedFees = {
  fastestFee: number;
  halfHourFee: number;
  hourFee: number;
  economyFee: number;
  minimumFee: number;
};

export type RefundRequest = {
  swapAddress: string;
  toAddress: string;
  satPerVbyte: number;
};

export type RefundResponse = {
  refundTxId: string;
};

export type ReverseSwapFeesRequest = {
  sendAmountSat?: number;
};

export type ReverseSwapInfo = {
  id: string;
  claimPubkey: string;
  lockupTxid?: string;
  claimTxid?: string;
  onchainAmountSat: number;
  status: ReverseSwapStatus;
};

export type ReverseSwapPairInfo = {
  min: number;
  max: number;
  feesHash: string;
  feesPercentage: number;
  feesLockup: number;
  feesClaim: number;
  totalEstimatedFees?: number;
};

export type RouteHint = {
  hops: RouteHintHop[];
};

export type RouteHintHop = {
  srcNodeId: string;
  shortChannelId: number;
  feesBaseMsat: number;
  feesProportionalMillionths: number;
  cltvExpiryDelta: number;
  htlcMinimumMsat?: number;
  htlcMaximumMsat?: number;
};

export type SendOnchainRequest = {
  amountSat: number;
  onchainRecipientAddress: string;
  pairHash: string;
  satPerVbyte: number;
};

export type SendOnchainResponse = {
  reverseSwapInfo: ReverseSwapInfo;
};

export type SendPaymentRequest = {
  bolt11: string;
  amountMsat?: number;
};

export type SendPaymentResponse = {
  payment: Payment;
};

export type SendSpontaneousPaymentRequest = {
  nodeId: string;
  amountMsat: number;
};

export type SignMessageRequest = {
  message: string;
};

export type SignMessageResponse = {
  signature: string;
};

export type StaticBackupRequest = {
  workingDir: string;
};

export type StaticBackupResponse = {
  backup?: string[];
};

export type SwapInfo = {
  bitcoinAddress: string;
  createdAt: number;
  lockHeight: number;
  paymentHash: number[];
  preimage: number[];
  privateKey: number[];
  publicKey: number[];
  swapperPublicKey: number[];
  script: number[];
  bolt11?: string;
  paidSats: number;
  unconfirmedSats: number;
  confirmedSats: number;
  status: SwapStatus;
  refundTxIds: string[];
  unconfirmedTxIds: string[];
  confirmedTxIds: string[];
  minAllowedDeposit: number;
  maxAllowedDeposit: number;
  lastRedeemError?: string;
  channelOpeningFees?: OpeningFeeParams;
};

export type SweepRequest = {
  toAddress: string;
  feeRateSatsPerVbyte: number;
};

export type SweepResponse = {
  txid: number[];
};

export type SymbolType = {
  grapheme?: string;
  template?: string;
  rtl?: boolean;
  position?: number;
};

export type UnspentTransactionOutput = {
  txid: number[];
  outnum: number;
  amountMillisatoshi: number;
  address: string;
  reserved: boolean;
};

export type UrlSuccessActionData = {
  description: string;
  url: string;
};

export enum BreezEventVariant {
  NEW_BLOCK = 'newBlock',
  INVOICE_PAID = 'invoicePaid',
  SYNCED = 'synced',
  PAYMENT_SUCCEED = 'paymentSucceed',
  PAYMENT_FAILED = 'paymentFailed',
  BACKUP_STARTED = 'backupStarted',
  BACKUP_SUCCEEDED = 'backupSucceeded',
  BACKUP_FAILED = 'backupFailed'
}

export type BreezEvent =
  | {
      type: BreezEventVariant.NEW_BLOCK;
      block: number;
    }
  | {
      type: BreezEventVariant.INVOICE_PAID;
      details: InvoicePaidDetails;
    }
  | {
      type: BreezEventVariant.SYNCED;
    }
  | {
      type: BreezEventVariant.PAYMENT_SUCCEED;
      details: Payment;
    }
  | {
      type: BreezEventVariant.PAYMENT_FAILED;
      details: PaymentFailedData;
    }
  | {
      type: BreezEventVariant.BACKUP_STARTED;
    }
  | {
      type: BreezEventVariant.BACKUP_SUCCEEDED;
    }
  | {
      type: BreezEventVariant.BACKUP_FAILED;
      details: BackupFailedData;
    };

export enum BuyBitcoinProvider {
  MOONPAY = 'moonpay'
}

export enum ChannelState {
  PENDING_OPEN = 'pendingOpen',
  OPENED = 'opened',
  PENDING_CLOSE = 'pendingClose',
  CLOSED = 'closed'
}

export enum EnvironmentType {
  PRODUCTION = 'production',
  STAGING = 'staging'
}

export enum FeeratePreset {
  REGULAR = 'regular',
  ECONOMY = 'economy',
  PRIORITY = 'priority'
}

export enum InputTypeVariant {
  BITCOIN_ADDRESS = 'bitcoinAddress',
  BOLT11 = 'bolt11',
  NODE_ID = 'nodeId',
  URL = 'url',
  LN_URL_PAY = 'lnUrlPay',
  LN_URL_WITHDRAW = 'lnUrlWithdraw',
  LN_URL_AUTH = 'lnUrlAuth',
  LN_URL_ERROR = 'lnUrlError'
}

export type InputType =
  | {
      type: InputTypeVariant.BITCOIN_ADDRESS;
      address: BitcoinAddressData;
    }
  | {
      type: InputTypeVariant.BOLT11;
      invoice: LnInvoice;
    }
  | {
      type: InputTypeVariant.NODE_ID;
      nodeId: string;
    }
  | {
      type: InputTypeVariant.URL;
      url: string;
    }
  | {
      type: InputTypeVariant.LN_URL_PAY;
      data: LnUrlPayRequestData;
    }
  | {
      type: InputTypeVariant.LN_URL_WITHDRAW;
      data: LnUrlWithdrawRequestData;
    }
  | {
      type: InputTypeVariant.LN_URL_AUTH;
      data: LnUrlAuthRequestData;
    }
  | {
      type: InputTypeVariant.LN_URL_ERROR;
      data: LnUrlErrorData;
    };

export enum LnUrlCallbackStatusVariant {
  OK = 'ok',
  ERROR_STATUS = 'errorStatus'
}

export type LnUrlCallbackStatus =
  | {
      type: LnUrlCallbackStatusVariant.OK;
    }
  | {
      type: LnUrlCallbackStatusVariant.ERROR_STATUS;
      data: LnUrlErrorData;
    };

export enum LnUrlPayResultVariant {
  ENDPOINT_SUCCESS = 'endpointSuccess',
  ENDPOINT_ERROR = 'endpointError'
}

export type LnUrlPayResult =
  | {
      type: LnUrlPayResultVariant.ENDPOINT_SUCCESS;
      data?: SuccessActionProcessed;
    }
  | {
      type: LnUrlPayResultVariant.ENDPOINT_ERROR;
      data: LnUrlErrorData;
    };

export enum LnUrlWithdrawResultVariant {
  OK = 'ok',
  ERROR_STATUS = 'errorStatus'
}

export type LnUrlWithdrawResult =
  | {
      type: LnUrlWithdrawResultVariant.OK;
      data: LnUrlWithdrawSuccessData;
    }
  | {
      type: LnUrlWithdrawResultVariant.ERROR_STATUS;
      data: LnUrlErrorData;
    };

export enum Network {
  BITCOIN = 'bitcoin',
  TESTNET = 'testnet',
  SIGNET = 'signet',
  REGTEST = 'regtest'
}

export enum NodeConfigVariant {
  GREENLIGHT = 'greenlight'
}

export type NodeConfig = {
  type: NodeConfigVariant.GREENLIGHT;
  config: GreenlightNodeConfig;
};

export enum PaymentDetailsVariant {
  LN = 'ln',
  CLOSED_CHANNEL = 'closedChannel'
}

export type PaymentDetails =
  | {
      type: PaymentDetailsVariant.LN;
      data: LnPaymentDetails;
    }
  | {
      type: PaymentDetailsVariant.CLOSED_CHANNEL;
      data: ClosedChannelPaymentDetails;
    };

export enum PaymentStatus {
  PENDING = 'pending',
  COMPLETE = 'complete',
  FAILED = 'failed'
}

export enum PaymentType {
  SENT = 'sent',
  RECEIVED = 'received',
  CLOSED_CHANNEL = 'closedChannel'
}

export enum PaymentTypeFilter {
  SENT = 'sent',
  RECEIVED = 'received',
  ALL = 'all'
}

export enum ReverseSwapStatus {
  INITIAL = 'initial',
  IN_PROGRESS = 'inProgress',
  CANCELLED = 'cancelled',
  COMPLETED_SEEN = 'completedSeen',
  COMPLETED_CONFIRMED = 'completedConfirmed'
}

export enum SuccessActionProcessedVariant {
  AES = 'aes',
  MESSAGE = 'message',
  URL = 'url'
}

export type SuccessActionProcessed =
  | {
      type: SuccessActionProcessedVariant.AES;
      data: AesSuccessActionDataDecrypted;
    }
  | {
      type: SuccessActionProcessedVariant.MESSAGE;
      data: MessageSuccessActionData;
    }
  | {
      type: SuccessActionProcessedVariant.URL;
      data: UrlSuccessActionData;
    };

export enum SwapStatus {
  INITIAL = 'initial',
  EXPIRED = 'expired'
}

// Request types
export interface ILightningStatus {
  pubkey: string;
  blockHeight: number;
  synced: boolean;
  localBalance: number;
  remoteBalance: number;
}

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
  return response.data;
};

/**
 * Generic postApi handler
 * @param url
 * @param data
 * @param defaultError
 * @returns T
 */
const postApiResponse = async <T, C extends object>(url: string, data: C, defaultError: string = 'Error'): Promise<T> => {
  const response: ILightningResponse<T> = await apiPost(url, data);
  if (!response.success) {
    throw new SdkError(response.errorMessage || defaultError, response.errorCode);
  }
  return response.data;
};

/**
 * Lightning interface
 */

export const getLightningConfig = async (): Promise<LightningConfig> => {
  return await apiGet('lightning/config');
};

export const postLightningConfig = async (data: LightningConfig): Promise<void> => {
  return await apiPost('lightning/config', data);
};

export const postSetupNode = async (data: NodeSetup): Promise<void> => {
  return postApiResponse<void, NodeSetup>('lightning/setup-node', data, 'Error calling postSetupNode');
};

/**
 * Breez SDK API interface
 */

export const getNodeInfo = async (): Promise<NodeState> => {
  return getApiResponse<NodeState>('lightning/node-info', 'Error calling getNodeInfo');
};

export const getListPayments = async (params: ListPaymentsRequest): Promise<Payment[]> => {
  return getApiResponse<Payment[]>(`lightning/list-payments?${qs.stringify(params, { skipNull: true })}`, 'Error calling getListPayments');
};

export const getOpenChannelFee = async (params: OpenChannelFeeRequest): Promise<OpenChannelFeeResponse> => {
  return getApiResponse<OpenChannelFeeResponse>(
    `lightning/open-channel-fee?${qs.stringify(params, { skipNull: true })}`,
    'Error calling getOpenChannelFee'
  );
};

export const getParseInput = async (params: ParseInputRequest): Promise<InputType> => {
  return getApiResponse<InputType>(`lightning/parse-input?${qs.stringify(params, { skipNull: true })}`, 'Error calling getParseInput');
};

export const postSendPayment = async (data: SendPaymentRequest): Promise<SendPaymentResponse> => {
  return postApiResponse<SendPaymentResponse, SendPaymentRequest>('lightning/send-payment', data, 'Error calling postSendPayment');
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
export const subscribeLightningConfig = (cb: TSubscriptionCallback<LightningConfig>) => {
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
