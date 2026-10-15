// SPDX-License-Identifier: Apache-2.0

import { apiPost } from '@/utils/request';

export const reconfigureHistoryRates = (): Promise<null> => {
  return apiPost('rates/reconfigure-history');
};
