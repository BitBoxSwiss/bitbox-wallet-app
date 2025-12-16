// SPDX-License-Identifier: Apache-2.0

import { apiGet } from '@/utils/request';
import { subscribeEndpoint, TSubscriptionCallback } from './subscribe';

export const getUsingMobileData = (): Promise<boolean> => {
  return apiGet('using-mobile-data');
};

export const subscribeUsingMobileData = (
  cb: TSubscriptionCallback<boolean>
) => (
  subscribeEndpoint('using-mobile-data', cb)
);
