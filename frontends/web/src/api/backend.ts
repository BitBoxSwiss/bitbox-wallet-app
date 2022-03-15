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

import { AccountCode, CoinCode } from './account';
import { apiGet, apiPost } from '../utils/request';

export interface ICoin {
    coinCode: CoinCode;
    name: string;
    canAddAccount: boolean;
    suggestedAccountName: string;
}

export interface ISuccess {
    success: boolean;
    errorMessage?: string;
    errorCode?: string;
}

export const getSupportedCoins = (): Promise<ICoin[]> => {
    return apiGet('supported-coins');
};

export const setAccountActive = (accountCode: AccountCode, active: boolean): Promise<ISuccess> => {
    return apiPost('set-account-active', { accountCode, active });
};

export const setTokenActive = (accountCode: AccountCode, tokenCode: string, active: boolean): Promise<ISuccess> => {
    return apiPost('set-token-active', { accountCode, tokenCode, active });
};

export const renameAccount = (accountCode: AccountCode, name: string): Promise<ISuccess> => {
    return apiPost('rename-account', { accountCode, name });
};

export const reinitializeAccounts = (): Promise<null> => {
    return apiPost('accounts/reinitialize');
};

export const getTesting = (): Promise<boolean> => {
    return apiGet('testing');
};

export const getQRCode = (data: string | undefined) => {
    if (!data) {
        return () => Promise.resolve('');
    }
    return (): Promise<string> => {
        return apiGet(`qr?data=${encodeURIComponent(data)}`);
    }
};
