// SPDX-License-Identifier: Apache-2.0

import { apiGet } from '@/utils/request';
import { subscribeEndpoint, TSubscriptionCallback } from './subscribe';

export const getOnline = (): Promise<boolean> => {
  return apiGet('online');
};

export const subscribeOnline = (
  cb: TSubscriptionCallback<boolean>
) => (
  subscribeEndpoint('online', cb)
);
