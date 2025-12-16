// SPDX-License-Identifier: Apache-2.0

import type { TTransactionType } from '@/api/account';

export const getTxSign = (type: TTransactionType) => {
  switch (type) {
  case 'send_to_self':
  case 'send':
    return '−';
  case 'receive':
    return '+';
  default:
    return '';
  }
};

export const getTxSignForTxDetail = (type: TTransactionType) => {
  switch (type) {
  case 'send':
    return '−';
  case 'receive':
    return '+';
  default:
    return '';
  }
};
