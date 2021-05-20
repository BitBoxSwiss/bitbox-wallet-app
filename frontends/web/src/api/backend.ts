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

import { CoinCode } from './account';
import { apiGet, apiPost } from '../utils/request';

export interface ICoin {
    coinCode: CoinCode;
    name: string;
    canAddAccount: boolean;
}

export interface ISuccess {
    success: boolean;
    errorMessage?: string;
}

export const getSupportedCoins = (): Promise<ICoin[]> => {
    return apiGet('supported-coins');
};

export const setTokenActive = (accountCode: string, tokenCode: string, active: boolean): Promise<ISuccess> => {
    return apiPost('set-token-active', { accountCode, tokenCode, active });
};

export const reinitializeAccounts = (): Promise<null> => {
    return apiPost('accounts/reinitialize');
};
