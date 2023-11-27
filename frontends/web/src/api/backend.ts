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
import { FailResponse, SuccessResponse } from './response';
import { TSubscriptionCallback, subscribeEndpoint } from './subscribe';

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

export const accountSetWatch = (accountCode: AccountCode, watch: boolean): Promise<ISuccess> => {
  return apiPost('account-set-watch', { accountCode, watch });
};

export const reinitializeAccounts = (): Promise<null> => {
  return apiPost('accounts/reinitialize');
};

export const getTesting = (): Promise<boolean> => {
  return apiGet('testing');
};

export type TQRCode = FailResponse | (SuccessResponse & { data: string; });

export const getQRCode = (data: string) => {
  return (): Promise<TQRCode> => {
    return apiGet(`qr?data=${encodeURIComponent(data)}`);
  };
};

export const getDefaultConfig = (): Promise<any> => {
  return apiGet('config/default');
};

export const socksProxyCheck = (proxyAddress: string): Promise<ISuccess> => {
  return apiPost('socksproxy/check', proxyAddress);
};

export type TSyncConnectKeystore = null | {
  typ: 'connect';
  keystoreName: string;
} | {
  typ: 'error';
  errorCode: 'wrongKeystore';
  errorMessage: '';
};

/**
 * Returns a function that subscribes a callback on a "connect-keystore".
 * Meant to be used with `useSubscribe`.
 */
export const syncConnectKeystore = () => {
  return (
    cb: TSubscriptionCallback<TSyncConnectKeystore>
  ) => {
    return subscribeEndpoint('connect-keystore', (
      obj: TSyncConnectKeystore,
    ) => {
      cb(obj);
    });
  };
};

export const cancelConnectKeystore = (): Promise<void> => {
  return apiPost('cancel-connect-keystore');
};

export const setWatchonly = (watchonly: boolean): Promise<ISuccess> => {
  return apiPost('set-watchonly', watchonly);
};
