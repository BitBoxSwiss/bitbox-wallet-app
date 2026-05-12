// SPDX-License-Identifier: Apache-2.0

import type { LineData } from 'lightweight-charts';
import type { TDetailStatus } from './bitsurance';
import type { ERC20CoinCode, ERC20TokenUnit } from './erc20';
import type { SuccessResponse } from './response';
import type { NonEmptyArray } from '@/utils/types';
import { apiGet, apiPost } from '@/utils/request';

export type NativeCoinCode = 'btc' | 'tbtc' | 'rbtc' | 'ltc' | 'tltc' | 'eth' | 'sepeth';

export type AccountCode = string;

export type Fiat = 'AUD' | 'BRL' | 'BTC' | 'CAD' | 'CHF' | 'CNY' | 'CZK' | 'EUR' | 'GBP' | 'HKD' | 'ILS' | 'JPY' | 'KRW' | 'NOK' | 'NZD' | 'PLN' | 'RUB' | 'sat' | 'SEK' | 'SGD' | 'USD';

export type ConversionUnit = Fiat | 'sat';

export type NativeCoinUnit = 'BTC' | 'sat' | 'LTC' | 'ETH' | 'TBTC' | 'RBTC' | 'tsat' | 'TLTC' | 'SEPETH';

export type CoinCode = NativeCoinCode | ERC20CoinCode | 'lightning';

export type CoinUnit = NativeCoinUnit | ERC20TokenUnit;

export type FiatWithDisplayName = {
  currency: Fiat;
  displayName: string;
};

export type TActiveToken = {
  tokenCode: ERC20CoinCode;
  accountCode: AccountCode;
};

export type TKeystore = {
  watchonly: boolean;
  rootFingerprint: string;
  name: string;
  lastConnected: string;
  connected: boolean;
};

export type TAccountBase = {
  keystore: TKeystore;
  active: boolean;
  coinCode: CoinCode;
  coinUnit: CoinUnit;
  code: AccountCode;
  name: string;
  receiveScriptType?: ScriptType;
  isToken: boolean;
};

export type TAccount = TAccountBase & {
  coinName: string;
  contractAddress?: string;
  activeTokens?: TActiveToken[];
  blockExplorerTxPrefix: string;
  blockExplorerAddressPrefix?: string;
  bitsuranceStatus?: TDetailStatus;
  accountNumber?: number;
};

export const getAccounts = (): Promise<TAccount[]> => {
  return apiGet('accounts');
};

export type CoinFormattedAmount = {
  coinCode: CoinCode;
  coinName: string;
  formattedAmount: TAmountWithConversions;
};

export type TAmountsByCoin = {
  [key in CoinCode]?: TAmountWithConversions;
};

export type TKeystoreBalance = {
  fiatUnit: ConversionUnit;
  total: string;
  coinsBalance?: TAmountsByCoin;
};

export type TKeystoresBalance = {
  [rootFingerprint in TKeystore['rootFingerprint']]: TKeystoreBalance;
};

export type TAccountsBalanceSummary = {
  keystoresBalance: TKeystoresBalance;
  coinsTotalBalance: CoinFormattedAmount[];
};

export type TAccountsBalanceSummaryResponse = {
  success: true;
  accountsBalanceSummary: TAccountsBalanceSummary;
} | {
  success: false;
};

export const getAccountsBalanceSummary = (): Promise<TAccountsBalanceSummaryResponse> => {
  return apiGet('accounts/balance-summary');
};

type TEthAccountCodeAndNameByAddress = SuccessResponse & {
  code: AccountCode;
  name: string;
  displayAddress: string;
} | {
  success: false;
  errorMessage: string;
};

export const getEthAccountCodeAndNameByAddress = (address: string): Promise<TEthAccountCodeAndNameByAddress> => {
  return apiPost('accounts/eth-account-code', { address });
};

export type TStatus = {
  disabled: boolean;
  synced: boolean;
  fatalError: boolean;
  offlineError: string | null;
};

export const getStatus = (code: AccountCode): Promise<TStatus> => {
  return apiGet(`account/${code}/status`);
};

export type ScriptType = 'p2pkh' | 'p2wpkh-p2sh' | 'p2wpkh' | 'p2tr';

export const allScriptTypes: ScriptType[] = ['p2pkh', 'p2wpkh-p2sh', 'p2wpkh', 'p2tr'];

type TKeyInfo = {
  keypath: string;
  rootFingerprint: string;
  xpub: string;
};

export type TBitcoinSimple = {
  keyInfo: TKeyInfo;
  scriptType: ScriptType;
  descriptor: string;
};

export type TEthereumSimple = {
  keyInfo: TKeyInfo;
};

export type TSigningConfiguration = {
  bitcoinSimple: TBitcoinSimple;
  ethereumSimple?: never;
} | {
  bitcoinSimple?: never;
  ethereumSimple: TEthereumSimple;
};

export type TSigningConfigurationList = null | {
  signingConfigurations: TSigningConfiguration[];
};

export const getInfo = (code: AccountCode) => {
  return (): Promise<TSigningConfigurationList> => {
    return apiGet(`account/${code}/info`);
  };
};

export const init = (code: AccountCode): Promise<null> => {
  return apiPost(`account/${code}/init`);
};

export type FormattedLineData = LineData & {
  formattedValue: string;
};

export type ChartData = FormattedLineData[];

type TChartDataResponse = {
  success: true;
  data: TChartData;
} | {
  success: false;
};

export type TChartData = {
  chartDataMissing: boolean;
  chartDataDaily: ChartData;
  chartDataHourly: ChartData;
  chartFiat: ConversionUnit;
  chartTotal: number | null;
  formattedChartTotal: string | null;
  chartIsUpToDate: boolean; // only valid if chartDataMissing is false
  lastTimestamp: number;
};

export const getChartData = (): Promise<TChartDataResponse> => {
  return apiGet('chart-data');
};

type Conversions = {
  [key in Fiat]?: string;
};

export type TAmountWithConversions = {
  amount: string;
  conversions?: Conversions;
  unit: CoinUnit;
  estimated: boolean;
};

export type TBalance = {
  hasAvailable: boolean;
  available: TAmountWithConversions;
  hasIncoming: boolean;
  incoming: TAmountWithConversions;
};

type TBalanceResponse = {
  success: true;
  balance: TBalance;
} | {
  success: false;
};

export const getBalance = (code: AccountCode): Promise<TBalanceResponse> => {
  return apiGet(`account/${code}/balance`);
};

export type TTransactionStatus = 'complete' | 'pending' | 'failed';
export type TTransactionType = 'send' | 'receive' | 'send_to_self';

export type TTransaction = {
  addresses: string[];
  amount: TAmountWithConversions;
  amountAtTime: TAmountWithConversions;
  fee: TAmountWithConversions;
  feeRatePerKb: TAmountWithConversions;
  deductedAmountAtTime: TAmountWithConversions;
  gas: number;
  nonce: number | null;
  internalID: string;
  note: string;
  numConfirmations: number;
  numConfirmationsComplete: number;
  size: number;
  status: TTransactionStatus;
  time: string | null;
  type: TTransactionType;
  txID: string;
  vsize: number;
  weight: number;
};

export type TTransactions = { success: false } | { success: true; list: TTransaction[] };

type TNoteTx = {
  internalTxID: string;
  note: string;
};

export const postNotesTx = (code: AccountCode, {
  internalTxID,
  note,
}: TNoteTx): Promise<null> => {
  return apiPost(`account/${code}/notes/tx`, { internalTxID, note });
};

export const getTransactionList = (code: AccountCode): Promise<TTransactions> => {
  return apiGet(`account/${code}/transactions`);
};

export const getTransaction = (code: AccountCode, id: TTransaction['internalID']): Promise<TTransaction | null> => {
  return apiGet(`account/${code}/transaction?id=${id}`);
};

type TExport = {
  success: boolean;
  path: string;
  errorMessage: string;
};

export const exportAccount = (code: AccountCode): Promise<TExport | null> => {
  return apiPost(`account/${code}/export`);
};

export const verifyXPub = (
  code: AccountCode,
  signingConfigIndex: number,
): Promise<{ success: true } | { success: false; errorMessage: string }> => {
  return apiPost(`account/${code}/verify-extended-public-key`, { signingConfigIndex });
};

export type TReceiveAddress = {
  addressID: string;
  address: string;
  displayAddress: string;
};

export type TReceiveAddressList = {
  scriptType: ScriptType | null;
  addresses: NonEmptyArray<TReceiveAddress>;
};

export type Slip24 = {
  recipientName: string;
  nonce: string | null;
  memos: Array<{
    type: 'text' | 'refund' | 'coinPurchase';
    text?: string;
    refund?: string;
    coinPurchase?: {
      coinType: number;
      amount: string;
      address: string;
      addressDerivation?: {
        eth?: {
          keypath: number[];
        };
        btc?: {
          keypath: number[];
          scriptType: ScriptType;
        };
      };
    };
  }>;
  outputs: Array<{
    amount: number;
    address: string;
  }>;
  signature: string;
};

export const getReceiveAddressList = (code: AccountCode) => {
  return (): Promise<NonEmptyArray<TReceiveAddressList> | null> => {
    return apiGet(`account/${code}/receive-addresses`);
  };
};

export type TTxInput = {
  address: string;
  amount: string;
  sendAll: 'yes' | 'no';
  selectedUTXOs: string[];
  paymentRequest: Slip24 | null;
} & (
  {
    useHighestFee: false;
    customFee: string;
    feeTarget: FeeTargetCode;
  } | {
    useHighestFee: true;
  }
);

export type TTxProposalErrorCode =
  | 'accountNotSynced'
  | 'feeTooLow'
  | 'feesNotAvailable'
  | 'insufficientFunds'
  | 'invalidAddress'
  | 'invalidAmount';

export type TTxProposalResult = {
  amount: TAmountWithConversions;
  fee: TAmountWithConversions;
  recipientDisplayAddress: string;
  success: true;
  total: TAmountWithConversions;
} | {
  errorCode?: TTxProposalErrorCode;
  success: false;
};

export const proposeTx = (
  accountCode: AccountCode,
  txInput: TTxInput,
): Promise<TTxProposalResult> => {
  return apiPost(`account/${accountCode}/tx-proposal`, txInput);
};

export type TSendTxErrorCode =
  | TTxProposalErrorCode
  | 'erc20InsufficientGasFunds'
  | 'syncInProgress'
  | 'wrongKeystore';

export type TSendTx = {
  success: true;
  txId: string;
} | {
  success: false;
  aborted: true;
} | {
  success: false;
  errorMessage?: string;
  errorCode?: TSendTxErrorCode;
};

export const sendTx = (
  code: AccountCode,
  txNote: string,
): Promise<TSendTx> => {
  return apiPost(`account/${code}/sendtx`, txNote);
};

export type FeeTargetCode = 'custom' | 'low' | 'economy' | 'normal' | 'high' | 'mHour' | 'mHalfHour' | 'mFastest';

export type TFeeTarget = {
  code: FeeTargetCode;
  feeRateInfo: string;
};

export type TFeeTargetList = {
  feeTargets: TFeeTarget[];
  defaultFeeTarget: FeeTargetCode;
};

export const getFeeTargetList = (code: AccountCode): Promise<TFeeTargetList> => {
  return apiGet(`account/${code}/fee-targets`);
};

export const verifyAddress = (code: AccountCode, addressID: string): Promise<boolean> => {
  return apiPost(`account/${code}/verify-address`, addressID);
};

export type TUTXO = {
  outPoint: string;
  txId: string;
  txOutput: number;
  address: string;
  amount: TAmountWithConversions;
  note: string;
  scriptType: ScriptType;
  addressReused: boolean;
  isChange: boolean;
  headerTimestamp: string | null;
};

export const getUTXOs = (code: AccountCode): Promise<TUTXO[]> => {
  return apiGet(`account/${code}/utxos`);
};

type TSecureOutput = {
  hasSecureOutput: boolean;
  optional: boolean;
};

export const hasSecureOutput = (code: AccountCode) => {
  return (): Promise<TSecureOutput> => {
    return apiGet(`account/${code}/has-secure-output`);
  };
};

type THasPaymentRequest = {
  success: boolean;
  errorMessage?: string;
  errorCode?: 'firmwareUpgradeRequired' | 'unsupportedFeature';
};

export const hasPaymentRequest = (code: AccountCode): Promise<THasPaymentRequest> => {
  return apiGet(`account/${code}/has-payment-request`);
};

export const hasSwapPaymentRequest = (code: AccountCode): Promise<THasPaymentRequest> => {
  return apiGet(`account/${code}/has-swap-payment-request`);
};

export type TAddAccount = {
  success: boolean;
  accountCode?: string;
  errorCode?: 'accountAlreadyExists' | 'accountLimitReached';
  errorMessage?: string;
};

export const addAccount = (coinCode: string, name: string): Promise<TAddAccount> => {
  return apiPost('account-add', {
    coinCode,
    name,
  });
};

export type TSignMessage = { success: false; aborted?: boolean; errorMessage?: string } | { success: true; signature: string };

export type TSignWalletConnectTx = {
  success: false;
  aborted?: boolean;
  errorMessage?: string;
} | {
  success: true;
  txHash: string;
  rawTx: string;
};

export const ethSignMessage = (code: AccountCode, message: string): Promise<TSignMessage> => {
  return apiPost(`account/${code}/eth-sign-msg`, message);
};

export const ethSignTypedMessage = (code: AccountCode, chainId: number, data: any): Promise<TSignMessage> => {
  return apiPost(`account/${code}/eth-sign-typed-msg`, { chainId, data });
};

export const ethSignWalletConnectTx = (code: AccountCode, send: boolean, chainId: number, tx: any): Promise<TSignWalletConnectTx> => {
  return apiPost(`account/${code}/eth-sign-wallet-connect-tx`, { send, chainId, tx });
};

type TAddressSignResponse = {
  success: true;
  signature: string;
  address: string;
  displayAddress: string;
} | {
  success: false;
  errorMessage?: string;
  errorCode?: 'userAbort' | 'wrongKeystore';
};

export const signBTCMessageUnusedAddress = (
  code: AccountCode,
  format: ScriptType | '',
  msg: string,
): Promise<TAddressSignResponse> => {
  return apiPost(`account/${code}/btc-sign-message-unused-address`, { format, msg });
};

export const signBTCMessageForAddress = (
  code: AccountCode,
  addressID: string,
  msg: string,
): Promise<TAddressSignResponse> => {
  return apiPost(`account/${code}/btc-sign-message-for-address`, { addressID, msg });
};

export const signETHMessageForAddress = (
  code: AccountCode,
  msg: string,
): Promise<TAddressSignResponse> => {
  return apiPost(`account/${code}/eth-sign-message-for-address`, { msg });
};

export type TUsedAddress = {
  address: string;
  displayAddress: string;
  addressID: string;
  addressType: 'receive' | 'change';
  canSignMsg: boolean;
  lastUsed: string | null;
};

export type TUsedAddressesResponse = {
  success: true;
  addresses: TUsedAddress[];
} | {
  success: false;
  errorCode?: 'syncInProgress' | 'notSupported' | 'loadFailed';
};

export const getUsedAddresses = (code: AccountCode): Promise<TUsedAddressesResponse> => {
  return apiGet(`account/${code}/used-addresses`);
};
