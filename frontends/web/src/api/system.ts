// SPDX-License-Identifier: Apache-2.0

import { apiPost } from '@/utils/request';

type TNotifyUserResponse = {
  success: true;
} | {
  success: false;
  errorMessage: string;
};

type TOpenResponse = {
  success: true;
} | {
  success: false;
  errorMessage: string;
};

export const notifyUser = (text: string): Promise<TNotifyUserResponse> => {
  return apiPost('notify-user', { text });
};

export const open = (href: string): Promise<TOpenResponse> => {
  return apiPost('open', href);
};
