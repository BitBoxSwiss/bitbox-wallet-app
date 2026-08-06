// SPDX-License-Identifier: Apache-2.0

import { subscribeEndpoint, TUnsubscribe } from './subscribe';
import { apiGet, apiPost } from '@/utils/request';

export type { TUnsubscribe };

type TKeystore = { type: 'hardware' | 'software' };
export type TKeystores = TKeystore[];

export type TKeystoreFeatures = {
  supportsSendToSelf: boolean;
};

export type TKeystoreFeaturesResponse = {
  success: boolean;
  features?: TKeystoreFeatures | null;
  errorMessage?: string;
};

export const subscribeKeystores = (
  cb: (keystores: TKeystores) => void
) => {
  return subscribeEndpoint('keystores', cb);
};

export const getKeystores = (): Promise<TKeystores> => {
  return apiGet('keystores');
};

export type TTestKeystoreEdition = 'btc-only' | 'multi';

type TRegisterTestResponse = {
  success: true;
} | {
  success: false;
  errorMessage: string;
};

export const registerTest = (pin: string, edition: TTestKeystoreEdition): Promise<TRegisterTestResponse> => {
  return apiPost('test/register', { pin, edition });
};

export const deregisterTest = (): Promise<null> => {
  return apiPost('test/deregister');
};

export type TConnectKeystoreResponse = {
  success: boolean;
  errorCode?: 'firmwareUpgradeRequired' | 'unsupportedFeature' | 'userAbort';
};

export type TKeystoreFeature =
  | 'btcTransactionSigning'
  | 'ethTransactionSigning'
  | 'messageSigning'
  | 'ethTypedMessageSigning'
  | 'paymentRequests'
  | 'swapPaymentRequests';

export const connectKeystore = (
  rootFingerprint: string,
  requiredFeature?: TKeystoreFeature,
): Promise<TConnectKeystoreResponse> => {
  return apiPost('connect-keystore', { rootFingerprint, requiredFeature });
};

export const connectAnyKeystore = (
  requiredFeature?: TKeystoreFeature,
): Promise<TConnectKeystoreResponse> => {
  return apiPost('connect-keystore', { rootFingerprint: '', requiredFeature });
};

export const getKeystoreFeatures = (rootFingerprint: string): Promise<TKeystoreFeaturesResponse> => {
  return apiGet(`keystore/${rootFingerprint}/features`);
};
