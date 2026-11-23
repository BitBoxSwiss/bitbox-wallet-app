// SPDX-License-Identifier: Apache-2.0

import { apiPost } from '@/utils/request';
import { subscribeEndpoint, type TSubscriptionCallback } from './subscribe';

export const authenticate = (
  force: boolean = false,
): Promise<void> => {
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