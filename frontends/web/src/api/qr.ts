// SPDX-License-Identifier: Apache-2.0

import { apiGet } from '@/utils/request';
import type { TFailResponse, TSuccessResponse } from './response';

type TQRCode = TFailResponse | (TSuccessResponse & { data: string });

export const getQRCode = (data: string) => {
  return (): Promise<TQRCode> => {
    return apiGet(`qr?data=${encodeURIComponent(data)}`);
  };
};
