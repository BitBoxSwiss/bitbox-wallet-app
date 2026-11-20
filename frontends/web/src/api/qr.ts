// SPDX-License-Identifier: Apache-2.0

import { apiGet } from '@/utils/request';
import type { FailResponse, SuccessResponse } from './response';

type TQRCode = FailResponse | (SuccessResponse & { data: string });

export const getQRCode = (data: string) => {
  return (): Promise<TQRCode> => {
    return apiGet(`qr?data=${encodeURIComponent(data)}`);
  };
};
