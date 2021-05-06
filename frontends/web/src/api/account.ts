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


export type CoinCode = 'btc' | 'tbtc' | 'ltc' | 'tltc' | 'eth' | 'teth' | 'reth';

export type Fiat = 'AUD' | 'BTC' | 'CAD' | 'CHF' | 'CNY' | 'EUR' | 'GBP' | 'ILS' | 'JPY' | 'KRW' | 'RUB' | 'SGD' | 'USD';

export type MainnetCoin = 'BTC' | 'LTC' | 'ETH';

export type TestnetCoin = 'TBTC' | 'TLTC' | 'TETH' | 'RETH';

export type Coin = MainnetCoin | TestnetCoin;


export interface IAccount {
    coinCode: CoinCode;
    coinUnit: string;
    code: string;
    name: string;
    blockExplorerTxPrefix: string;
}

export const getAccounts = (): Promise<IAccount[]> => {
    return apiGet(`accounts`);
};

export interface IStatus {
    disabled: boolean;
    synced: boolean;
    fatalError: boolean;
    offlineError: string | null;
}

export const getStatus = (code: string): Promise<IStatus> => {
    return apiGet(`account/${code}/status`);
};

export type ScriptType = 'p2pkh' | 'p2wpkh-p2sh' | 'p2wpkh';

export interface IKeyInfo {
    keypath: string;
    xpub: string;
}

export interface ISigningConfiguration {
    bitcoinSimple?: {
        keyInfo: IKeyInfo;
        scriptType: ScriptType;
    };
    ethereumSimple?: {
        keyInfo: IKeyInfo;
    }
}

export interface ISigningConfigurationList {
    signingConfigurations: ISigningConfiguration[];
}

export const getInfo = (code: string): Promise<ISigningConfigurationList> => {
    return apiGet(`account/${code}/info`);
};

export const init = (code: string): Promise<null> => {
    return apiPost(`account/${code}/init`);
};

export interface ISummary {
    chartDataMissing: boolean;
    chartDataDaily: ChartData;
    chartDataHourly: ChartData;
    chartFiat: Fiat;
    chartTotal: number | null;
    chartIsUpToDate: boolean; // only valid if chartDataMissing is false
}

export const getSummary = (): Promise<ISummary> => {
    return apiGet('account-summary');
};

export const exportSummary = (): Promise<string> => {
    return apiPost('export-account-summary');
};

export type Conversions = null | {
    [key in Fiat]: string;
}

export interface IAmount {
    amount: string;
    conversions: Conversions;
    unit: Coin;
}

export interface IBalance {
    available: IAmount;
    hasIncoming: boolean;
    incoming: IAmount;
}

export const getBalance = (code: string): Promise<IBalance> => {
    return apiGet(`account/${code}/balance`);
};

export interface ITransaction {
    addresses: string[];
    amount: IAmount;
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

export const postNotesTx = (code: string, {
    internalTxID,
    note,
}: INoteTx): Promise<null> => {
    return apiPost(`account/${code}/notes/tx`, { internalTxID, note });
};

export const getTransactionList = (code: string): Promise<ITransaction[]> => {
    return apiGet(`account/${code}/transactions`);
};

export const exportAccount = (code: string): Promise<string> => {
    return apiPost(`account/${code}/export`);
};

export interface IReceiveAddress {
    addressID: string;
    address: string;
}

export type ReceiveAddressList = IReceiveAddress[][];

export const getReceiveAddressList = (code: string): Promise<ReceiveAddressList> => {
    return apiGet(`account/${code}/receive-addresses`);
};

export interface ISendTx {
    aborted?: boolean;
    success?: boolean;
    errorMessage?: string;
}

export const sendTx = (code: string): Promise<ISendTx> => {
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

export const getFeeTargetList = (code: string): Promise<IFeeTargetList> => {
    return apiGet(`account/${code}/fee-targets`);
};
