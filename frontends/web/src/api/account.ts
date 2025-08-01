/**
 * Copyright 2021-2025 Shift Crypto AG
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

import type { LineData } from 'lightweight-charts';
import { apiGet, apiPost } from '@/utils/request';
import type { TDetailStatus } from './bitsurance';
import type { SuccessResponse } from './response';
import { Slip24 } from 'request-address';

export type NativeCoinCode = 'btc' | 'tbtc' | 'rbtc' | 'ltc' | 'tltc' | 'eth' | 'sepeth';

export type AccountCode = string;

export type Fiat = 'AUD' | 'BRL' | 'BTC' | 'CAD' | 'CHF' | 'CNY' | 'CZK' | 'EUR' | 'GBP' | 'HKD' | 'ILS' | 'JPY' | 'KRW' | 'NOK' | 'PLN' | 'RUB' | 'sat' | 'SEK' | 'SGD' | 'USD';

export type ConversionUnit = Fiat | 'sat'

export type CoinUnit = 'BTC' | 'sat' | 'LTC' | 'ETH' | 'TBTC' | 'tsat' | 'TLTC' | 'SEPETH';

export type ERC20TokenUnit = 'USDT' | 'USDC' | 'LINK' | 'BAT' | 'MKR' | 'ZRX' | 'WBTC' | 'PAXG' | 'DAI';

export type ERC20CoinCode = 'erc20Test' | 'eth-erc20-usdt' | 'eth-erc20-usdc' | 'eth-erc20-link' | 'eth-erc20-bat' | 'eth-erc20-mkr' | 'eth-erc20-zrx' | 'eth-erc20-wbtc' | 'eth-erc20-paxg' | 'eth-erc20-dai0x6b17';

export type CoinCode = NativeCoinCode | ERC20CoinCode;

export type FiatWithDisplayName = {
  currency: Fiat,
  displayName: string
}

export type Terc20Token = {
  code: ERC20CoinCode;
  name: string;
  unit: ERC20TokenUnit;
};

export interface IActiveToken {
  tokenCode: ERC20CoinCode;
  accountCode: AccountCode;
}

export type TKeystore = {
  watchonly: boolean;
  rootFingerprint: string;
  name: string;
  lastConnected: string;
  connected: boolean;
};

export interface IAccount {
  keystore: TKeystore;
  active: boolean;
  watch: boolean;
  coinCode: CoinCode;
  coinUnit: CoinUnit;
  coinName: string;
  code: AccountCode;
  name: string;
  isToken: boolean;
  activeTokens?: IActiveToken[];
  blockExplorerTxPrefix: string;
  bitsuranceStatus?: TDetailStatus;
}

export const getAccounts = (): Promise<IAccount[]> => {
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
}

export const getAccountsBalanceSummary = (): Promise<TAccountsBalanceSummaryResponse> => {
  return apiGet('accounts/balance-summary');
};

type TEthAccountCodeAndNameByAddress = SuccessResponse & {
  code: AccountCode;
  name: string;
}

export const getEthAccountCodeAndNameByAddress = (address: string): Promise<TEthAccountCodeAndNameByAddress> => {
  return apiPost('accounts/eth-account-code', { address });
};

export interface IStatus {
    disabled: boolean;
    synced: boolean;
    fatalError: boolean;
    offlineError: string | null;
}

export const getStatus = (code: AccountCode): Promise<IStatus> => {
  return apiGet(`account/${code}/status`);
};

export type ScriptType = 'p2pkh' | 'p2wpkh-p2sh' | 'p2wpkh' | 'p2tr';

export const allScriptTypes: ScriptType[] = ['p2pkh', 'p2wpkh-p2sh', 'p2wpkh', 'p2tr'];

export interface IKeyInfo {
    keypath: string;
    rootFingerprint: string;
    xpub: string;
}

export type TBitcoinSimple = {
    keyInfo: IKeyInfo;
    scriptType: ScriptType;
}

export type TEthereumSimple = {
    keyInfo: IKeyInfo;
}

export type TSigningConfiguration = {
    bitcoinSimple: TBitcoinSimple;
    ethereumSimple?: never;
} | {
    bitcoinSimple?: never;
    ethereumSimple: TEthereumSimple;
}

export type TSigningConfigurationList = null | {
    signingConfigurations: TSigningConfiguration[];
}

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

export type TChartDataResponse = {
    success: true;
    data: TChartData;
} | {
  success: false;
}

export type TChartData = {
    chartDataMissing: boolean;
    chartDataDaily: ChartData;
    chartDataHourly: ChartData;
    chartFiat: ConversionUnit;
    chartTotal: number | null;
    formattedChartTotal: string | null;
    chartIsUpToDate: boolean; // only valid if chartDataMissing is false
    lastTimestamp: number;
}

export const getChartData = (): Promise<TChartDataResponse> => {
  return apiGet('chart-data');
};

export type Conversions = {
    [key in Fiat]?: string;
};

export type TAmountWithConversions = {
    amount: string;
    conversions?: Conversions;
    unit: CoinUnit;
    estimated: boolean;
};

export interface IBalance {
    hasAvailable: boolean;
    available: TAmountWithConversions;
    hasIncoming: boolean;
    incoming: TAmountWithConversions;
}

export type TBalanceResponse = {
  success: true;
  balance: IBalance;
} | {
  success: false;
}

export const getBalance = (code: AccountCode): Promise<TBalanceResponse> => {
  return apiGet(`account/${code}/balance`);
};

export type TTransactionStatus = 'complete' | 'pending' | 'failed';
export type TTransactionType = 'send' | 'receive' | 'send_to_self';

export interface ITransaction {
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
}

export type TTransactions = { success: false } | { success: true; list: ITransaction[]; };

export interface INoteTx {
    internalTxID: string;
    note: string;
}

export const postNotesTx = (code: AccountCode, {
  internalTxID,
  note,
}: INoteTx): Promise<null> => {
  return apiPost(`account/${code}/notes/tx`, { internalTxID, note });
};

export const getTransactionList = (code: AccountCode): Promise<TTransactions> => {
  return apiGet(`account/${code}/transactions`);
};

export const getTransaction = (code: AccountCode, id: ITransaction['internalID']): Promise<ITransaction | null> => {
  return apiGet(`account/${code}/transaction?id=${id}`);
};

export interface IExport {
    success: boolean;
    path: string;
    errorMessage: string;
}

export const exportAccount = (code: AccountCode): Promise<IExport | null> => {
  return apiPost(`account/${code}/export`);
};

export const verifyXPub = (
  code: AccountCode,
  signingConfigIndex: number,
): Promise<{ success: true; } | { success: false; errorMessage: string; }> => {
  return apiPost(`account/${code}/verify-extended-public-key`, { signingConfigIndex });
};

export interface IReceiveAddress {
    addressID: string;
    address: string;
}

export interface ReceiveAddressList {
    scriptType: ScriptType | null;
    addresses: IReceiveAddress[];
}

export const getReceiveAddressList = (code: AccountCode) => {
  return (): Promise<ReceiveAddressList[] | null> => {
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

export type TTxProposalResult = {
  amount: TAmountWithConversions;
  fee: TAmountWithConversions;
  success: true;
  total: TAmountWithConversions;
} | {
  errorCode: string;
  success: false;
};

export const proposeTx = (
  accountCode: AccountCode,
  txInput: TTxInput,
): Promise<TTxProposalResult> => {
  return apiPost(`account/${accountCode}/tx-proposal`, txInput);
};

export type TSendTx = {
  success: true;
} | {
  success: false;
  aborted: true;
} | {
  success: false;
  errorMessage: string;
  errorCode?: string;
};

export const sendTx = (
  code: AccountCode,
  txNote: string,
): Promise<TSendTx> => {
  return apiPost(`account/${code}/sendtx`, txNote);
};

export type FeeTargetCode = 'custom' | 'low' | 'economy' | 'normal' | 'high' | 'mHour' | 'mHalfHour' | 'mFastest';

export interface IProposeTxData {
    address?: string;
    amount?: number;
    // data?: string;
    feePerByte: string;
    feeTarget: FeeTargetCode;
    selectedUTXOs: string[];
    sendAll: 'yes' | 'no';
}

export interface IProposeTx {
    aborted?: boolean;
    success?: boolean;
    errorMessage?: string;
}

export interface IFeeTarget {
    code: FeeTargetCode;
    feeRateInfo: string;
}

export interface IFeeTargetList {
    feeTargets: IFeeTarget[];
    defaultFeeTarget: FeeTargetCode;
}

export const getFeeTargetList = (code: AccountCode): Promise<IFeeTargetList> => {
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

export type TAddAccount = {
  success: boolean;
  accountCode?: string;
  errorCode?: 'accountAlreadyExists' | 'accountLimitReached';
  errorMessage?: string;
}

export const addAccount = (coinCode: string, name: string): Promise<TAddAccount> => {
  return apiPost('account-add', {
    coinCode,
    name,
  });
};

export type TSignMessage = { success: false, aborted?: boolean; errorMessage?: string; } | { success: true; signature: string; }

export type TSignWalletConnectTx = {
  success: false;
  aborted?: boolean;
  errorMessage?: string;
} | {
  success: true;
  txHash: string;
  rawTx: string;
}

export const ethSignMessage = (code: AccountCode, message: string): Promise<TSignMessage> => {
  return apiPost(`account/${code}/eth-sign-msg`, message);
};

export const ethSignTypedMessage = (code: AccountCode, chainId: number, data: any): Promise<TSignMessage> => {
  return apiPost(`account/${code}/eth-sign-typed-msg`, { chainId, data });
};

export const ethSignWalletConnectTx = (code: AccountCode, send: boolean, chainId: number, tx: any): Promise<TSignWalletConnectTx> => {
  return apiPost(`account/${code}/eth-sign-wallet-connect-tx`, { send, chainId, tx });
};

export type AddressSignResponse = {
  success: true;
  signature: string;
  address: string;
} | {
  success: false;
  errorMessage?: string;
  errorCode?: 'userAbort' | 'wrongKeystore';
}

export const signAddress = (format: ScriptType | '', msg: string, code: AccountCode): Promise<AddressSignResponse> => {
  return apiPost(`account/${code}/sign-address`, { format, msg, code });
};
