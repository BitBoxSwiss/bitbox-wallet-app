// SPDX-License-Identifier: Apache-2.0

import { apiPost } from '@/utils/request';

export const notifyUser = (text: string) => {
  return apiPost('notify-user', { text });
};

type TOpenResponse = {
  success: true;
} | {
  success: false;
  errorMessage?: string;
};

export const open = (href: string): Promise<TOpenResponse> => {
  return apiPost('open', href);
};
