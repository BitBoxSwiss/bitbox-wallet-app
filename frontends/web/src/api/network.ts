// SPDX-License-Identifier: Apache-2.0

import { apiGet, apiPost } from '@/utils/request';
import { subscribeEndpoint, type TSubscriptionCallback } from './subscribe';
import type { TSuccess } from './response';

export const getUsingMobileData = (): Promise<boolean> => {
  return apiGet('using-mobile-data');
};

export const subscribeUsingMobileData = (
  cb: TSubscriptionCallback<boolean>
) => (
  subscribeEndpoint('using-mobile-data', cb)
);

export const getOnline = (): Promise<boolean> => {
  return apiGet('online');
};

export const subscribeOnline = (
  cb: TSubscriptionCallback<boolean>
) => (
  subscribeEndpoint('online', cb)
);

export const socksProxyCheck = (proxyAddress: string): Promise<TSuccess> => {
  return apiPost('socksproxy/check', proxyAddress);
};
