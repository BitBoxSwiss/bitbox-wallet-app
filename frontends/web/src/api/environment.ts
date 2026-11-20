// SPDX-License-Identifier: Apache-2.0

import { apiGet } from '@/utils/request';

export const getTesting = (): Promise<boolean> => {
  return apiGet('testing');
};

export const getDevServers = (): Promise<boolean> => {
  return apiGet('dev-servers');
};
