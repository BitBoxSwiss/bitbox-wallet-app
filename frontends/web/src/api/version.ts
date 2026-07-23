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

export type TUpdateState = {
  revision: number;
  update: TUpdateFile | null;
};

export const getVersion = (): Promise<string> => {
  return apiGet('version');
};

export const getUpdate = (): Promise<TUpdateState> => {
  return apiGet('update');
};

export const subscribeUpdate = (
  cb: TSubscriptionCallback<TUpdateState>
) => (
  subscribeEndpoint('update', cb)
);
