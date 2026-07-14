// SPDX-License-Identifier: Apache-2.0

import { apiGet } from '@/utils/request';
import { subscribeEndpoint, TSubscriptionCallback } from './subscribe';

/**
 * Describes the cached result of the backend update check.
 */
export type TUpdateFile = {
  current: string;
  version: string;
  description: string;
};

export const getVersion = (): Promise<string> => {
  return apiGet('version');
};

export const getUpdate = (): Promise<TUpdateFile | null> => {
  return apiGet('update');
};

export const subscribeUpdate = (
  cb: TSubscriptionCallback<TUpdateFile | null>
) => (
  subscribeEndpoint('update', cb)
);
