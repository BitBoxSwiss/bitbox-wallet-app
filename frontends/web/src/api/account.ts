/**
 * Copyright 2021-2024 Shift Crypto AG
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
import { ChartData } from '../routes/account/summary/chart';
import type { TDetailStatus } from './bitsurance';
import { SuccessResponse } from './response';

export type CoinCode = 'btc' | 'tbtc' | 'ltc' | 'tltc' | 'eth' | 'goeth' | 'sepeth';

export type AccountCode = string;

export type Fiat = 'AUD' | 'BRL' | 'BTC' | 'CAD' | 'CHF' | 'CNY' | 'CZK' | 'EUR' | 'GBP' | 'HKD' | 'ILS' | 'JPY' | 'KRW' | 'NOK' | 'PLN' | 'RUB' | 'sat' | 'SEK' | 'SGD' | 'USD';

export type ConversionUnit = Fiat | 'sat'

export type CoinUnit = 'BTC' | 'sat' | 'LTC' | 'ETH' | 'TBTC' | 'tsat' | 'TLTC' | 'GOETH' | 'SEPETH';

export type ERC20TokenUnit = 'USDT' | 'USDC' | 'LINK' | 'BAT' | 'MKR' | 'ZRX' | 'WBTC' | 'PAXG' | 'DAI';

export type Terc20Token = {
  code: string;
  name: string;
  unit: ERC20TokenUnit;
};

export interface IActiveToken {
  tokenCode: string;
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
  coinUnit: string;
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

export type TAccountsBalanceByCoin = {
    [key: string]: IAmount;
};

export type TAccountsBalance = {
  [rootFingerprint: string]: TAccountsBalanceByCoin;
};

export const getAccountsBalance = (): Promise<TAccountsBalance> => {
  return apiGet('accounts/balance');
};

export type TAccountTotalBalance = {
    fiatUnit: ConversionUnit;
    total: string;
};

export type TAccountsTotalBalance = {
    [key: string]: TAccountTotalBalance;
};

export type TAccountsTotalBalanceResponse = {
    success: true;
    totalBalance: TAccountsTotalBalance;
} | {
    success: false;
    errorCode?: 'ratesNotAvailable';
    errorMessage?: string;
}

export const getAccountsTotalBalance = (): Promise<TAccountsTotalBalanceResponse> => {
  return apiGet('accounts/total-balance');
};

type CoinFormattedAmount = {
  coinCode: CoinCode;
  coinName: string;
  formattedAmount: IAmount;
};

export type TCoinsTotalBalance = CoinFormattedAmount[];

export const getCoinsTotalBalance = (): Promise<TCoinsTotalBalance> => {
  return apiGet('accounts/coins-balance');
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

export interface ISummary {
    chartDataMissing: boolean;
    chartDataDaily: ChartData;
    chartDataHourly: ChartData;
    chartFiat: ConversionUnit;
    chartTotal: number | null;
    formattedChartTotal: string | null;
    chartIsUpToDate: boolean; // only valid if chartDataMissing is false
    lastTimestamp: number;
}

export const getSummary = (): Promise<ISummary> => {
  return apiGet('account-summary');
};

export type Conversions = {
    [key in Fiat]: string;
}

export interface IAmount {
    amount: string;
    conversions?: Conversions;
    unit: CoinUnit;
}

export interface IBalance {
    hasAvailable: boolean;
    available: IAmount;
    hasIncoming: boolean;
    incoming: IAmount;
}

export const getBalance = (code: AccountCode): Promise<IBalance> => {
  return apiGet(`account/${code}/balance`);
};

export type TTxStatus = 'complete' | 'pending' | 'failed';
export type TTxType = 'send' | 'receive' | 'self';

export interface ITransaction {
    addresses: string[];
    amount: IAmount;
    amountAtTime: IAmount | null;
    fee: IAmount;
    feeRatePerKb: IAmount;
    gas: number;
    nonce: number | null;
    internalID: string;
    note: string;
    numConfirmations: number;
    numConfirmationsComplete: number;
    size: number;
    status: TTxStatus;
    time: string | null;
    type: TTxType;
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

export const proposeTxNote = (code: AccountCode, note: string): Promise<null> => {
  return apiPost(`account/${code}/propose-tx-note`, note);
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
  feeTarget: FeeTargetCode;
  customFee: string;
  sendAll: 'yes' | 'no';
  selectedUTXOs: string[],
};

export type TTxProposalResult = {
  amount: IAmount;
  fee: IAmount;
  success: true;
  total: IAmount;
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

export interface ISendTx {
    aborted?: boolean;
    success?: boolean;
    errorMessage?: string;
    errorCode?: string;
}

export const sendTx = (code: AccountCode): Promise<ISendTx> => {
  return apiPost(`account/${code}/sendtx`);
};

export type FeeTargetCode = 'custom' | 'low' | 'economy' | 'normal' | 'high';

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
    feeTargets: IFeeTarget[],
    defaultFeeTarget: FeeTargetCode
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
  amount: IAmount;
  note: string;
  scriptType: ScriptType;
  addressReused: boolean;
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

export const connectKeystore = (code: AccountCode): Promise<{ success: boolean; }> => {
  return apiPost(`account/${code}/connect-keystore`);
};

export type TSignMessage = { success: false, aborted?: boolean; errorMessage?: string; } | { success: true; signature: string; }

export type TSignWalletConnectTx = {
  success: false,
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
