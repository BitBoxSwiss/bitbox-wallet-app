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

export const registerTest = (pin: string): Promise<null> => {
  return apiPost('test/register', { pin });
};

export const deregisterTest = (): Promise<null> => {
  return apiPost('test/deregister');
};

export type TConnectKeystoreResponse = {
  success: boolean;
  errorCode?: string;
};

export const connectKeystore = (rootFingerprint: string): Promise<TConnectKeystoreResponse> => {
  return apiPost('connect-keystore', { rootFingerprint });
};

export const getKeystoreFeatures = (rootFingerprint: string): Promise<TKeystoreFeaturesResponse> => {
  return apiGet(`keystore/${rootFingerprint}/features`);
};
