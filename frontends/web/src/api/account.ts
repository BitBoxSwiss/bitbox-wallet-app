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
import { ChartData } from '../routes/account/summary/chart';

export type CoinCode = 'btc' | 'tbtc' | 'ltc' | 'tltc' | 'eth' | 'goeth';

export type AccountCode = string;

export type Fiat = 'AUD' | 'BRL' | 'BTC' | 'CAD' | 'CHF' | 'CNY' | 'EUR' | 'GBP' | 'HKD' | 'ILS' | 'JPY' | 'KRW' | 'NOK' | 'RUB' | 'SEK' | 'SGD' | 'USD';

export type ConversionUnit = Fiat | 'sat'

export type MainnetCoin = 'BTC' | 'LTC' | 'ETH';

export type TestnetCoin = 'TBTC' | 'TLTC' | 'GOETH';

export type Coin = MainnetCoin | TestnetCoin;

export type CoinWithSAT = Coin | 'sat' | 'tsat';

export interface IActiveToken {
    tokenCode: string;
    accountCode: AccountCode;
}

export interface IAccount {
    active: boolean;
    coinCode: CoinCode;
    coinUnit: string;
    coinName: string;
    code: AccountCode;
    name: string;
    isToken: boolean;
    activeTokens?: IActiveToken[];
    blockExplorerTxPrefix: string;
}

export const getAccounts = (): Promise<IAccount[]> => {
  return apiGet('accounts');
};

export interface ITotalBalance {
    [key: string]: IAmount;

}

export const getAccountsTotalBalance = (): Promise<ITotalBalance> => {
  return apiGet('accounts/total-balance');
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
}

export const getSummary = (): Promise<ISummary> => {
  return apiGet('account-summary');
};

export const exportSummary = (): Promise<string> => {
  return apiPost('export-account-summary');
};

export type Conversions = {
    [key in Fiat]: string;
}

export interface IAmount {
    amount: string;
    conversions?: Conversions;
    unit: Coin;
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
    status: 'complete' | 'pending' | 'failed';
    time: string | null;
    type: 'send' | 'receive' | 'self';
    txID: string;
    vsize: number;
    weight: number;
}

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

export const getTransactionList = (code: AccountCode): Promise<ITransaction[]> => {
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

export const getCanVerifyXPub = (code: AccountCode) => {
  return (): Promise<boolean> => {
    return apiGet(`account/${code}/can-verify-extended-public-key`);
  };
};

export const verifyXPub = (
  code: AccountCode,
  signingConfigIndex: number,
): Promise<void> => {
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
  scriptType: ScriptType;
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