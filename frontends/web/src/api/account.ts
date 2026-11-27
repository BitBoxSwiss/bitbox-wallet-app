// SPDX-License-Identifier: Apache-2.0

import type { LineData } from 'lightweight-charts';
import type { TDetailStatus } from './bitsurance';
import type { TERC20CoinCode, TERC20TokenUnit } from './erc20';
import type { TSuccessResponse, TSuccess } from './response';
import type { NonEmptyArray } from '@/utils/types';
import { apiGet, apiPost } from '@/utils/request';

export type TNativeCoinCode = 'btc' | 'tbtc' | 'rbtc' | 'ltc' | 'tltc' | 'eth' | 'sepeth';

export type TAccountCode = string;

export type TFiat = 'AUD' | 'BRL' | 'BTC' | 'CAD' | 'CHF' | 'CNY' | 'CZK' | 'EUR' | 'GBP' | 'HKD' | 'ILS' | 'JPY' | 'KRW' | 'NOK' | 'NZD' | 'PLN' | 'RUB' | 'sat' | 'SEK' | 'SGD' | 'USD';

export type TConversionUnit = TFiat | 'sat';

export type TNativeCoinUnit = 'BTC' | 'sat' | 'LTC' | 'ETH' | 'TBTC' | 'RBTC' | 'tsat' | 'TLTC' | 'SEPETH';

export type TCoinCode = TNativeCoinCode | TERC20CoinCode | 'lightning';

export type TCoinUnit = TNativeCoinUnit | TERC20TokenUnit;

export type TFiatWithDisplayName = {
  currency: TFiat;
  displayName: string;
};

export type TActiveToken = {
  tokenCode: TERC20CoinCode;
  accountCode: TAccountCode;
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
  coinCode: TCoinCode;
  coinUnit: TCoinUnit;
  code: TAccountCode;
  name: string;
  receiveScriptType?: TScriptType;
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

type TParsedPaymentInput = {
  // Parsing succeeded; field errors still require correction before creating a proposal.
  success: true;
  recipient: string;
  // Omitted keeps the entered amount; an empty string clears it.
  amount?: string;
  validationError?: 'invalidAddress' | 'invalidAmount';
} | {
  success: false;
  errorCode?: 'accountMismatch' | 'invalidFormat';
};

export const parsePaymentInput = (
  code: TAccountCode,
  input: string,
): Promise<TParsedPaymentInput> => {
  return apiGet(`account/${code}/parse-payment-input?input=${encodeURIComponent(input)}`);
};

export type TCoinFormattedOptionalAmount = {
  coinCode: TCoinCode;
  coinName: string;
  formattedAmount?: TAmountWithConversions;
};

export type TCoinFormattedAmount = Required<TCoinFormattedOptionalAmount>;

export type TAmountsByCoin = {
  [key in TCoinCode]?: TAmountWithConversions;
};

export type TKeystoreBalance = {
  fiatUnit: TConversionUnit;
  total: string;
  coinsBalance?: TAmountsByCoin;
};

export type TKeystoresBalance = {
  [rootFingerprint in TKeystore['rootFingerprint']]: TKeystoreBalance;
};

export type TAccountsBalanceSummary = {
  keystoresBalance: TKeystoresBalance;
  coinsTotalBalance: TCoinFormattedAmount[];
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

type TEthAccountCodeAndNameByAddress = TSuccessResponse & {
  code: TAccountCode;
  name: string;
  displayAddress: string;
} | {
  success: false;
  errorMessage: string;
};

export const getEthAccountCodeAndNameByAddress = (address: string): Promise<TEthAccountCodeAndNameByAddress> => {
  return apiPost('accounts/eth-account-code', { address });
};

export const postEthAccountActivity = (
  code: TAccountCode,
  active: boolean,
): Promise<TSuccessResponse> => {
  return apiPost(`account/${code}/activity`, { active });
};

export type TStatus = {
  disabled: boolean;
  synced: boolean;
  fatalError: boolean;
  offlineError: string | null;
};

export const getStatus = (code: TAccountCode): Promise<TStatus> => {
  return apiGet(`account/${code}/status`);
};

export type TScriptType = 'p2pkh' | 'p2wpkh-p2sh' | 'p2wpkh' | 'p2tr';

export const allScriptTypes: TScriptType[] = ['p2pkh', 'p2wpkh-p2sh', 'p2wpkh', 'p2tr'];

type TKeyInfo = {
  keypath: string;
  rootFingerprint: string;
  xpub: string;
};

export type TBitcoinSimple = {
  keyInfo: TKeyInfo;
  scriptType: TScriptType;
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

type TAccountError = { success: false; errorMessage: string };

export const getInfo = (code: TAccountCode) => {
  return (): Promise<{ success: true; info: TSigningConfigurationList } | TAccountError> => {
    return apiGet(`account/${code}/info`);
  };
};

export const init = (code: TAccountCode): Promise<TSuccessResponse | TAccountError> => {
  return apiPost(`account/${code}/init`);
};

export type TFormattedLineData = LineData & {
  formattedValue: string;
};

export type TChartLineData = TFormattedLineData[];

export type TChartTransactionMarkerAmount = {
  amount: string;
  count: number;
  estimated: boolean;
};

export type TChartTransactionMarker = {
  time: number;
  receive: TChartTransactionMarkerAmount;
  send: TChartTransactionMarkerAmount;
};

export type TChartTransactionMarkers = {
  daily: TChartTransactionMarker[];
  hourly: TChartTransactionMarker[];
};

type TChartDataResponse = {
  success: true;
  data: TChartData;
} | {
  success: false;
};

export type TChartPerformance = {
  moneyWeightedReturn: number | null;
  startTimestamp: number | null;
};

export type TChartPerformanceByDisplay = {
  week: TChartPerformance;
  month: TChartPerformance;
  year: TChartPerformance;
  all: TChartPerformance;
};

export type TChartData = {
  chartDataMissing: boolean;
  chartDataDaily: TChartLineData;
  chartDataHourly: TChartLineData;
  chartTransactionMarkers?: TChartTransactionMarkers;
  chartFiat: TConversionUnit;
  chartPerformance: TChartPerformanceByDisplay;
  chartTotal: number | null;
  formattedChartTotal: string | null;
  chartIsUpToDate: boolean; // only valid if chartDataMissing is false
  lastTimestamp: number;
};

export const getChartData = (includeTransactionMarkers: boolean): Promise<TChartDataResponse> => {
  return apiGet(`chart-data?includeTransactionMarkers=${String(includeTransactionMarkers)}`);
};

type Conversions = {
  [key in TFiat]?: string;
};

export type TAmountWithConversions = {
  amount: string;
  conversions?: Conversions;
  unformattedConversions?: Conversions;
  unit: TCoinUnit;
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

export const getBalance = (code: TAccountCode): Promise<TBalanceResponse> => {
  return apiGet(`account/${code}/balance`);
};

export type TTransactionStatus = 'complete' | 'pending' | 'failed';
export type TTransactionType = 'send' | 'receive' | 'send_to_self';

export type TTransaction = {
  addresses: string[];
  amount: TAmountWithConversions;
  amountAtTime: TAmountWithConversions;
  fee: TAmountWithConversions;
  feeRateInfo: string;
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

export const postNotesTx = (code: TAccountCode, {
  internalTxID,
  note,
}: TNoteTx): Promise<TSuccessResponse | TAccountError> => {
  return apiPost(`account/${code}/notes/tx`, { internalTxID, note });
};

export const getTransactionList = (code: TAccountCode): Promise<TTransactions> => {
  return apiGet(`account/${code}/transactions`);
};

export const getTransaction = (code: TAccountCode, id: TTransaction['internalID']): Promise<
  { success: true; transaction: TTransaction | null } | TAccountError
> => {
  return apiGet(`account/${code}/transaction?id=${id}`);
};

type TExport = {
  success: boolean;
  path: string;
  errorMessage: string;
};

export const exportAccount = (code: TAccountCode): Promise<TExport | null> => {
  return apiPost(`account/${code}/export`);
};

export const verifyXPub = (
  code: TAccountCode,
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
  scriptType: TScriptType | null;
  addresses: NonEmptyArray<TReceiveAddress>;
};

type TSlip24AddressDerivation = {
  eth?: {
    keypath: number[];
  };
  btc?: {
    keypath: number[];
    scriptType: TScriptType;
  };
};

export type TSlip24 = {
  recipientName: string;
  nonce: string | null;
  memos: Array<{
    type: 'text' | 'refund' | 'coinPurchase';
    text?: string;
    refund?: {
      address: string;
      addressDerivation?: TSlip24AddressDerivation;
    };
    coinPurchase?: {
      coinType: number;
      amount: string;
      address: string;
      addressDerivation?: TSlip24AddressDerivation;
    };
  }>;
  outputs: Array<{
    // Pocket's request-address library uses numbers; backend amounts use strings.
    amount: number | string;
    address: string;
  }>;
  signature: string;
};

export const getReceiveAddressList = (code: TAccountCode) => {
  return (): Promise<{ success: true; addresses: NonEmptyArray<TReceiveAddressList> } | TAccountError> => {
    return apiGet(`account/${code}/receive-addresses`);
  };
};

export type TTxInput = {
  address: string;
  amount: string;
  sendAll: 'yes' | 'no';
  selectedUTXOs: string[];
  paymentRequest: TSlip24 | null;
} & (
  {
    useHighestFee: false;
    customFee: string;
    feeTarget: TFeeTargetCode;
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
  highFeePercentage?: string;
  recipientDisplayAddress: string;
  success: true;
  total: TAmountWithConversions;
} | {
  errorCode?: TTxProposalErrorCode;
  errorMessage?: string;
  success: false;
};

export const proposeTx = (
  accountCode: TAccountCode,
  txInput: TTxInput,
): Promise<TTxProposalResult> => {
  return apiPost(`account/${accountCode}/tx-proposal`, txInput);
};

export type TSendTxErrorCode =
  | TTxProposalErrorCode
  | 'broadcastUncertain'
  | 'erc20InsufficientGasFunds'
  | 'firmwareUpgradeRequired'
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
  code: TAccountCode,
  txNote: string,
): Promise<TSendTx> => {
  return apiPost(`account/${code}/sendtx`, txNote);
};

export type TFeeTargetCode = 'custom' | 'low' | 'economy' | 'normal' | 'high' | 'mHour' | 'mHalfHour' | 'mFastest';

export type TFeeTarget = {
  code: TFeeTargetCode;
  feeRateInfo: string;
};

export type TFeeTargetList = {
  feeTargets: TFeeTarget[];
  defaultFeeTarget: TFeeTargetCode;
};

export const getFeeTargetList = (code: TAccountCode): Promise<TFeeTargetList> => {
  return apiGet(`account/${code}/fee-targets`);
};

export const verifyAddress = (code: TAccountCode, addressID: string): Promise<
  { success: true } | { success: false; errorCode?: 'firmwareUpgradeRequired'; errorMessage?: string }
> => {
  return apiPost(`account/${code}/verify-address`, addressID);
};

export type TUTXO = {
  outPoint: string;
  txId: string;
  txOutput: number;
  address: string;
  amount: TAmountWithConversions;
  note: string;
  scriptType: TScriptType;
  addressReused: boolean;
  isChange: boolean;
  headerTimestamp: string | null;
};

export type TUTXOsResponse = {
  success: true;
  utxos: TUTXO[];
} | TAccountError;

export const getUTXOs = (code: TAccountCode): Promise<TUTXOsResponse> => {
  return apiGet(`account/${code}/utxos`);
};

type TSecureOutput = {
  hasSecureOutput: boolean;
  optional: boolean;
};

export const hasSecureOutput = (code: TAccountCode) => {
  return (): Promise<TSecureOutput> => {
    return apiGet(`account/${code}/has-secure-output`);
  };
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

export type TSignMessage = {
  success: false;
  aborted?: boolean;
  errorMessage?: string;
  errorCode?: 'firmwareUpgradeRequired';
} | {
  success: true;
  signature: string;
};

export type TSignWalletConnectTx = {
  success: false;
  aborted?: boolean;
  errorMessage?: string;
  errorCode?: 'firmwareUpgradeRequired' | 'insufficientFunds' | 'broadcastUncertain';
  txHash?: string;
} | {
  success: true;
  txHash: string;
  rawTx: string;
};

export const ethSignMessage = (code: TAccountCode, message: string): Promise<TSignMessage> => {
  return apiPost(`account/${code}/eth-sign-msg`, message);
};

export const ethSignTypedMessage = (code: TAccountCode, chainId: number, data: string): Promise<TSignMessage> => {
  return apiPost(`account/${code}/eth-sign-typed-msg`, { chainId, data });
};

export const ethSignWalletConnectTx = (
  code: TAccountCode,
  send: boolean,
  chainId: number,
  tx: Record<string, unknown>,
): Promise<TSignWalletConnectTx> => {
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
  errorCode?: 'firmwareUpgradeRequired' | 'userAbort' | 'wrongKeystore';
};

export const signBTCMessageUnusedAddress = (
  code: TAccountCode,
  format: TScriptType | '',
  msg: string,
): Promise<TAddressSignResponse> => {
  return apiPost(`account/${code}/btc-sign-message-unused-address`, { format, msg });
};

export const signBTCMessageForAddress = (
  code: TAccountCode,
  addressID: string,
  msg: string,
): Promise<TAddressSignResponse> => {
  return apiPost(`account/${code}/btc-sign-message-for-address`, { addressID, msg });
};

export const signETHMessageForAddress = (
  code: TAccountCode,
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

export const getUsedAddresses = (code: TAccountCode): Promise<TUsedAddressesResponse> => {
  return apiGet(`account/${code}/used-addresses`);
};

export const setAccountActive = (
  accountCode: TAccountCode,
  active: boolean,
): Promise<TSuccess> => {
  return apiPost('set-account-active', { accountCode, active });
};

export const setAccountReceiveScriptType = (
  accountCode: TAccountCode,
  scriptType: TScriptType,
): Promise<TSuccess> => {
  return apiPost('set-account-receive-script-type', { accountCode, scriptType });
};

export const renameAccount = (
  accountCode: TAccountCode,
  name: string,
): Promise<TSuccess> => {
  return apiPost('rename-account', { accountCode, name });
};
