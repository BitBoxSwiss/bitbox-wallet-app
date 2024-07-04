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
import { AccountCode, IBalance } from './account';
import { TSubscriptionCallback, subscribeEndpoint } from './subscribe';
import qs from 'query-string';

export interface ILightningResponse<T> {
  success: boolean;
  data: T;
  errorMessage?: string;
  errorCode?: string;
}

export type TLightningAccountConfig = {
  mnemonic: string;
  rootFingerprint: string;
  code: AccountCode;
  num: number;
};

export type TLightningConfig = {
  accounts: TLightningAccountConfig[];
};

export type NodeSetup = {
  entropy: string;
};

// Breez SDK types

export interface AesSuccessActionDataDecrypted {
  description: string;
  plaintext: string;
}

export interface BackupFailedData {
  error: string;
}

export interface BackupStatus {
  backedUp: boolean;
  lastBackupTime?: number;
}

export interface BitcoinAddressData {
  address: string;
  network: Network;
  amountSat?: number;
  label?: string;
  message?: string;
}

export interface BuyBitcoinRequest {
  provider: BuyBitcoinProvider;
  openingFeeParams?: OpeningFeeParams;
}

export interface BuyBitcoinResponse {
  url: string;
  openingFeeParams?: OpeningFeeParams;
}

export interface CheckMessageRequest {
  message: string;
  pubkey: string;
  signature: string;
}

export interface CheckMessageResponse {
  isValid: boolean;
}

export interface ClosedChannelPaymentDetails {
  state: ChannelState;
  fundingTxid: string;
  shortChannelId?: string;
  closingTxid?: string;
}

export interface Config {
  breezserver: string;
  chainnotifierUrl: string;
  mempoolspaceUrl?: string;
  workingDir: string;
  network: Network;
  paymentTimeoutSec: number;
  defaultLspId?: string;
  apiKey?: string;
  maxfeePercent: number;
  exemptfeeMsat: number;
  nodeConfig: NodeConfig;
}

export interface ConfigureNodeRequest {
  closeToAddress?: string;
}

export interface ConnectRequest {
  config: Config;
  seed: number[];
  restoreOnly?: boolean;
}

export interface CurrencyInfo {
  name: string;
  fractionSize: number;
  spacing?: number;
  symbol?: SymbolType;
  uniqSymbol?: SymbolType;
  localizedName?: LocalizedName[];
  localeOverrides?: LocaleOverrides[];
}

export interface FiatCurrency {
  id: string;
  info: CurrencyInfo;
}

export interface GreenlightCredentials {
  deviceKey: number[];
  deviceCert: number[];
}

export interface GreenlightNodeConfig {
  partnerCredentials?: GreenlightCredentials;
  inviteCode?: string;
}

export interface InvoicePaidDetails {
  paymentHash: string;
  bolt11: string;
  payment?: Payment;
}

export interface LnInvoice {
  bolt11: string;
  network: Network;
  payeePubkey: string;
  paymentHash: string;
  description?: string;
  descriptionHash?: string;
  amountMsat?: number;
  timestamp: number;
  expiry: number;
  routingHints: RouteHint[];
  paymentSecret: number[];
  minFinalCltvExpiryDelta: number;
}

export interface ListPaymentsRequest {
  filters?: PaymentTypeFilter[];
  metadataFilters?: MetadataFilter[];
  fromTimestamp?: number;
  toTimestamp?: number;
  includeFailures?: boolean;
  offset?: number;
  limit?: number;
}

export interface LnPaymentDetails {
  paymentHash: string;
  label: string;
  destinationPubkey: string;
  paymentPreimage: string;
  keysend: boolean;
  bolt11: string;
  openChannelBolt11?: string;
  lnurlSuccessAction?: SuccessActionProcessed;
  lnurlPayDomain?: string;
  lnurlPayComment?: string;
  lnurlMetadata?: string;
  lnAddress?: string;
  lnurlWithdrawEndpoint?: string;
  swapInfo?: SwapInfo;
  reverseSwapInfo?: ReverseSwapInfo;
  pendingExpirationBlock?: number;
}

export interface LnUrlAuthRequestData {
  k1: string;
  domain: string;
  url: string;
  action?: string;
}

export interface LnUrlErrorData {
  reason: string;
}

export interface LnUrlPayErrorData {
  paymentHash: string;
  reason: string;
}

export interface LnUrlPayRequest {
  data: LnUrlPayRequestData;
  amountMsat: number;
  comment?: string;
  paymentLabel?: string;
}

export interface LnUrlPayRequestData {
  callback: string;
  minSendable: number;
  maxSendable: number;
  metadataStr: string;
  commentAllowed: number;
  domain: string;
  allowsNostr: boolean;
  nostrPubkey?: string;
  lnAddress?: string;
}

export interface LnUrlPaySuccessData {
  successAction?: SuccessActionProcessed;
  payment: Payment;
}

export interface LnUrlWithdrawRequest {
  data: LnUrlWithdrawRequestData;
  amountMsat: number;
  description?: string;
}

export interface LnUrlWithdrawRequestData {
  callback: string;
  k1: string;
  defaultDescription: string;
  minWithdrawable: number;
  maxWithdrawable: number;
}

export interface LnUrlWithdrawSuccessData {
  invoice: LnInvoice;
}

export interface LocaleOverrides {
  locale: string;
  spacing?: number;
  symbol: SymbolType;
}

export interface LocalizedName {
  locale: string;
  name: string;
}

export interface LogEntry {
  line: string;
  level: string;
}

export interface LspInformation {
  id: string;
  name: string;
  widgetUrl: string;
  pubkey: string;
  host: string;
  baseFeeMsat: number;
  feeRate: number;
  timeLockDelta: number;
  minHtlcMsat: number;
  lspPubkey: number[];
  openingFeeParamsList: OpeningFeeParamsMenu;
}

export interface MaxReverseSwapAmountResponse {
  totalSat: number;
}

export interface MessageSuccessActionData {
  message: string;
}

export interface MetadataFilter {
  jsonPath: string;
  jsonValue: string;
}

export interface MetadataItem {
  key: string;
  value: string;
}

export interface NodeState {
  id: string;
  blockHeight: number;
  channelsBalanceMsat: number;
  onchainBalanceMsat: number;
  pendingOnchainBalanceMsat: number;
  utxos: UnspentTransactionOutput[];
  maxPayableMsat: number;
  maxReceivableMsat: number;
  maxSinglePaymentAmountMsat: number;
  maxChanReserveMsats: number;
  connectedPeers: string[];
  inboundLiquidityMsats: number;
}

export interface OnchainPaymentLimitsResponse {
  minSat: number;
  maxSat: number;
}

export interface OpenChannelFeeRequest {
  amountMsat?: number;
  expiry?: number;
}

export interface OpenChannelFeeResponse {
  feeMsat?: number;
  feeParams: OpeningFeeParams;
}

export interface OpeningFeeParams {
  minMsat: number;
  proportional: number;
  validUntil: string;
  maxIdleTime: number;
  maxClientToSelfDelay: number;
  promise: string;
}

export interface OpeningFeeParamsMenu {
  values: OpeningFeeParams[];
}

export interface PayOnchainRequest {
  recipientAddress: string;
  prepareRes: PrepareOnchainPaymentResponse;
}

export interface PayOnchainResponse {
  reverseSwapInfo: ReverseSwapInfo;
}

export interface Payment {
  id: string;
  paymentType: PaymentType;
  paymentTime: number;
  amountMsat: number;
  feeMsat: number;
  status: PaymentStatus;
  error?: string;
  description?: string;
  details: PaymentDetails;
  metadata?: string;
}

export interface PaymentFailedData {
  error: string;
  nodeId: string;
  invoice?: LnInvoice;
  label?: string;
}

export interface PrepareOnchainPaymentRequest {
  amountSat: number;
  amountType: SwapAmountType;
  claimTxFeerate: number;
}

export interface PrepareOnchainPaymentResponse {
  feesHash: string;
  feesPercentage: number;
  feesLockup: number;
  feesClaim: number;
  senderAmountSat: number;
  recipientAmountSat: number;
  totalFees: number;
}

export interface PrepareRedeemOnchainFundsRequest {
  toAddress: string;
  satPerVbyte: number;
}

export interface PrepareRedeemOnchainFundsResponse {
  txWeight: number;
  txFeeSat: number;
}

export interface PrepareRefundRequest {
  swapAddress: string;
  toAddress: string;
  satPerVbyte: number;
}

export interface PrepareRefundResponse {
  refundTxWeight: number;
  refundTxFeeSat: number;
}

export interface Rate {
  coin: string;
  value: number;
}

export interface ReceiveOnchainRequest {
  openingFeeParams?: OpeningFeeParams;
}

export interface ReceivePaymentRequest {
  amountMsat: number;
  description: string;
  preimage?: number[];
  openingFeeParams?: OpeningFeeParams;
  useDescriptionHash?: boolean;
  expiry?: number;
  cltv?: number;
}

export interface ReceivePaymentResponse {
  lnInvoice: LnInvoice;
  openingFeeParams?: OpeningFeeParams;
  openingFeeMsat?: number;
}

export interface RecommendedFees {
  fastestFee: number;
  halfHourFee: number;
  hourFee: number;
  economyFee: number;
  minimumFee: number;
}

export interface RedeemOnchainFundsRequest {
  toAddress: string;
  satPerVbyte: number;
}

export interface RedeemOnchainFundsResponse {
  txid: number[];
}

export interface RefundRequest {
  swapAddress: string;
  toAddress: string;
  satPerVbyte: number;
}

export interface RefundResponse {
  refundTxId: string;
}

export interface ReportPaymentFailureDetails {
  paymentHash: string;
  comment?: string;
}

export interface ReverseSwapFeesRequest {
  sendAmountSat?: number;
  claimTxFeerate?: number;
}

export interface ReverseSwapInfo {
  id: string;
  claimPubkey: string;
  lockupTxid?: string;
  claimTxid?: string;
  onchainAmountSat: number;
  status: ReverseSwapStatus;
}

export interface ReverseSwapPairInfo {
  min: number;
  max: number;
  feesHash: string;
  feesPercentage: number;
  feesLockup: number;
  feesClaim: number;
  totalFees?: number;
}

export interface RouteHint {
  hops: RouteHintHop[];
}

export interface RouteHintHop {
  srcNodeId: string;
  shortChannelId: number;
  feesBaseMsat: number;
  feesProportionalMillionths: number;
  cltvExpiryDelta: number;
  htlcMinimumMsat?: number;
  htlcMaximumMsat?: number;
}

export interface SendOnchainRequest {
  amountSat: number;
  onchainRecipientAddress: string;
  pairHash: string;
  satPerVbyte: number;
}

export interface SendOnchainResponse {
  reverseSwapInfo: ReverseSwapInfo;
}

export interface SendPaymentRequest {
  bolt11: string;
  amountMsat?: number;
  label?: string;
}

export interface SendPaymentResponse {
  payment: Payment;
}

export interface SendSpontaneousPaymentRequest {
  nodeId: string;
  amountMsat: number;
  extraTlvs?: TlvEntry[];
  label?: string;
}

export interface ServiceHealthCheckResponse {
  status: HealthCheckStatus;
}

export interface SignMessageRequest {
  message: string;
}

export interface SignMessageResponse {
  signature: string;
}

export interface StaticBackupRequest {
  workingDir: string;
}

export interface StaticBackupResponse {
  backup?: string[];
}

export interface SwapInfo {
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
  paidMsat: number;
  unconfirmedSats: number;
  confirmedSats: number;
  totalIncomingTxs: number;
  status: SwapStatus;
  refundTxIds: string[];
  unconfirmedTxIds: string[];
  confirmedTxIds: string[];
  minAllowedDeposit: number;
  maxAllowedDeposit: number;
  maxSwapperPayable: number;
  lastRedeemError?: string;
  channelOpeningFees?: OpeningFeeParams;
  confirmedAt?: number;
}

export interface SymbolType {
  grapheme?: string;
  template?: string;
  rtl?: boolean;
  position?: number;
}

export interface TlvEntry {
  fieldNumber: number;
  value: number[];
}

export interface UnspentTransactionOutput {
  txid: number[];
  outnum: number;
  amountMillisatoshi: number;
  address: string;
  reserved: boolean;
}

export interface UrlSuccessActionData {
  description: string;
  url: string;
}

export enum AesSuccessActionDataResultVariant {
  DECRYPTED = 'decrypted',
  ERROR_STATUS = 'errorStatus'
}

export type AesSuccessActionDataResult =
  | {
      type: AesSuccessActionDataResultVariant.DECRYPTED;
      data: AesSuccessActionDataDecrypted;
    }
  | {
      type: AesSuccessActionDataResultVariant.ERROR_STATUS;
      reason: string;
    };

export enum BreezEventVariant {
  NEW_BLOCK = 'newBlock',
  INVOICE_PAID = 'invoicePaid',
  SYNCED = 'synced',
  PAYMENT_SUCCEED = 'paymentSucceed',
  PAYMENT_FAILED = 'paymentFailed',
  BACKUP_STARTED = 'backupStarted',
  BACKUP_SUCCEEDED = 'backupSucceeded',
  BACKUP_FAILED = 'backupFailed',
  SWAP_UPDATED = 'swapUpdated'
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
    }
  | {
      type: BreezEventVariant.SWAP_UPDATED;
      details: SwapInfo;
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

export enum HealthCheckStatus {
  OPERATIONAL = 'operational',
  MAINTENANCE = 'maintenance',
  SERVICE_DISRUPTION = 'serviceDisruption'
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
  ENDPOINT_ERROR = 'endpointError',
  PAY_ERROR = 'payError'
}

export type LnUrlPayResult =
  | {
      type: LnUrlPayResultVariant.ENDPOINT_SUCCESS;
      data: LnUrlPaySuccessData;
    }
  | {
      type: LnUrlPayResultVariant.ENDPOINT_ERROR;
      data: LnUrlErrorData;
    }
  | {
      type: LnUrlPayResultVariant.PAY_ERROR;
      data: LnUrlPayErrorData;
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

export interface NodeConfig {
  type: NodeConfigVariant.GREENLIGHT;
  config: GreenlightNodeConfig;
}

export enum NodeCredentialsVariant {
  GREENLIGHT = 'greenlight'
}

export interface NodeCredentials {
  type: NodeCredentialsVariant.GREENLIGHT;
  credentials: GreenlightCredentials;
}

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
  CLOSED_CHANNEL = 'closedChannel'
}

export enum ReportIssueRequestVariant {
  PAYMENT_FAILURE = 'paymentFailure'
}

export interface ReportIssueRequest {
  type: ReportIssueRequestVariant.PAYMENT_FAILURE;
  data: ReportPaymentFailureDetails;
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
      result: AesSuccessActionDataResult;
    }
  | {
      type: SuccessActionProcessedVariant.MESSAGE;
      data: MessageSuccessActionData;
    }
  | {
      type: SuccessActionProcessedVariant.URL;
      data: UrlSuccessActionData;
    };

export enum SwapAmountType {
  SEND = 'send',
  RECEIVE = 'receive'
}

export enum SwapStatus {
  INITIAL = 'initial',
  WAITING_CONFIRMATION = 'waitingConfirmation',
  REDEEMABLE = 'redeemable',
  REDEEMED = 'redeemed',
  REFUNDABLE = 'refundable',
  COMPLETED = 'completed'
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
const postApiResponse = async <T, C extends object | undefined>(url: string, data: C, defaultError: string = 'Error'): Promise<T> => {
  const response: ILightningResponse<T> = await apiPost(url, data);
  if (!response.success) {
    throw new SdkError(response.errorMessage || defaultError, response.errorCode);
  }
  return response.data;
};

/**
 * Lightning interface
 */

export const getLightningConfig = async (): Promise<TLightningConfig> => {
  return await apiGet('lightning/config');
};

export const postLightningConfig = async (data: TLightningConfig): Promise<void> => {
  return await apiPost('lightning/config', data);
};

export const postActivateNode = async (): Promise<void> => {
  return postApiResponse<void, undefined>('lightning/activate-node', undefined, 'Error calling postActivateNode');
};

export const postDeactivateNode = async (): Promise<void> => {
  return postApiResponse<void, undefined>('lightning/deactivate-node', undefined, 'Error calling postDeactivateNode');
};

export const getLightningBalance = async (): Promise<IBalance> => {
  return getApiResponse<IBalance>('lightning/balance', 'Error calling getLightningBalance');
};

/**
 * Breez SDK API interface
 */

export const getNodeInfo = async (): Promise<NodeState> => {
  return getApiResponse<NodeState>('lightning/node-info', 'Error calling getNodeInfo');
};

export const getListPayments = async (params: ListPaymentsRequest): Promise<Payment[]> => {
  return getApiResponse<Payment[]>(
    `lightning/list-payments?${qs.stringify(params, { skipNull: true })}`,
    'Error calling getListPayments'
  );
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
