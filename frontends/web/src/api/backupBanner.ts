// SPDX-License-Identifier: Apache-2.0

import type { TFiat } from './account';
import { apiGet } from '@/utils/request';

export type TShowBackupBannerResponse = {
  success: false;
} | {
  success: true;
  show: boolean;
  fiat: TFiat;
  threshold: string;
};

export const getShowBackupBanner = (rootFingerprint: string): Promise<TShowBackupBannerResponse> => {
  return apiGet(`keystore/show-backup-banner/${rootFingerprint}`);
};
