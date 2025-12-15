// SPDX-License-Identifier: Apache-2.0

import type { AccountCode, CoinCode, ERC20CoinCode } from './account';
import type { FailResponse, SuccessResponse } from './response';
import { apiGet, apiPost } from '@/utils/request';
import { TSubscriptionCallback, subscribeEndpoint } from './subscribe';

export type TCoin = {
  coinCode: CoinCode;
  name: string;
  canAddAccount: boolean;
  suggestedAccountName: string;
};

// In other places we use type { FailResponse, SuccessResponse } from './response'
// which has slightly different FailResponse structure ( message?: string; code?: number)
// but here we use errorMessage and errorCode instead
type TSuccess = {
  success: boolean;
  errorMessage?: string;
  errorCode?: string;
};

export const getSupportedCoins = (): Promise<TCoin[]> => {
  return apiGet('supported-coins');
};

export const setAccountActive = (accountCode: AccountCode, active: boolean): Promise<TSuccess> => {
  return apiPost('set-account-active', { accountCode, active });
};

export const setTokenActive = (
  accountCode: AccountCode,
  tokenCode: ERC20CoinCode,
  active: boolean,
): Promise<TSuccess> => {
  return apiPost('set-token-active', { accountCode, tokenCode, active });
};

export const renameAccount = (accountCode: AccountCode, name: string): Promise<TSuccess> => {
  return apiPost('rename-account', { accountCode, name });
};

export const reinitializeAccounts = (): Promise<null> => {
  return apiPost('accounts/reinitialize');
};

export const getTesting = (): Promise<boolean> => {
  return apiGet('testing');
};

export const getDevServers = (): Promise<boolean> => {
  return apiGet('dev-servers');
};

type TQRCode = FailResponse | (SuccessResponse & { data: string });

export const getQRCode = (data: string) => {
  return (): Promise<TQRCode> => {
    return apiGet(`qr?data=${encodeURIComponent(data)}`);
  };
};

export const getDefaultConfig = (): Promise<any> => {
  return apiGet('config/default');
};

export const socksProxyCheck = (proxyAddress: string): Promise<TSuccess> => {
  return apiPost('socksproxy/check', proxyAddress);
};

export type TConnectKeystoreErrorCode = 'wrongKeystore' | 'timeout';

export type TSyncConnectKeystore = null | {
  typ: 'connect';
  keystoreName: string;
} | {
  typ: 'error';
  errorCode?: TConnectKeystoreErrorCode;
  errorMessage: string;
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

export const setWatchonly = (rootFingerprint: string, watchonly: boolean): Promise<TSuccess> => {
  return apiPost('set-watchonly', { rootFingerprint, watchonly });
};

export const authenticate = (force: boolean = false): Promise<void> => {
  return apiPost('authenticate', force);
};

export const forceAuth = (): Promise<void> => {
  return apiPost('force-auth');
};

export type TAuthEventObject = {
  typ: 'auth-required' | 'auth-forced';
} | {
  typ: 'auth-result';
  result: 'authres-cancel' | 'authres-ok' | 'authres-err' | 'authres-missing';
};

export const subscribeAuth = (
  cb: TSubscriptionCallback<TAuthEventObject>
) => (
  subscribeEndpoint('auth', cb)
);

export const onAuthSettingChanged = (): Promise<void> => {
  return apiPost('on-auth-setting-changed');
};

export const exportLogs = (): Promise<TSuccess> => {
  return apiPost('export-log');
};

export const exportNotes = (): Promise<(FailResponse & { aborted: boolean }) | SuccessResponse> => {
  return apiPost('notes/export');
};

type TImportNotes = {
  accountCount: number;
  transactionCount: number;
};

export const importNotes = (fileContents: ArrayBuffer): Promise<FailResponse | (SuccessResponse & { data: TImportNotes })> => {
  const hexString = Array.from(new Uint8Array(fileContents))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
  return apiPost('notes/import', hexString);
};
