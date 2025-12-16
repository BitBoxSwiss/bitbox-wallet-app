// SPDX-License-Identifier: Apache-2.0

import { apiPost } from '@/utils/request';

export const notifyUser = (text: string) => {
  return apiPost('notify-user', { text });
};

export const open = (href: string) => {
  return apiPost('open', href);
};
