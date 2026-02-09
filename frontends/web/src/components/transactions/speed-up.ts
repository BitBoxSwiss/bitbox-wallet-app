// SPDX-License-Identifier: Apache-2.0

import type { CoinCode, TTransactionStatus, TTransactionType } from '@/api/account';

export const RBF_PENDING_THRESHOLD_MS = 60 * 60 * 1000;

const RBF_COIN_CODES: CoinCode[] = ['btc', 'tbtc', 'rbtc'];

type TSpeedUpEligibilityInput = {
  coinCode: CoinCode;
  isTesting?: boolean;
  numConfirmations: number;
  status: TTransactionStatus;
  time: string | null;
  type: TTransactionType;
  now?: number;
};

export const shouldShowSpeedUpPopup = ({
  coinCode,
  isTesting = false,
  numConfirmations,
  status,
  time,
  type,
  now = Date.now(),
}: TSpeedUpEligibilityInput): boolean => {
  if (!RBF_COIN_CODES.includes(coinCode)) {
    return false;
  }
  if (status !== 'pending' || numConfirmations !== 0) {
    return false;
  }
  if (type !== 'send' && type !== 'send_to_self') {
    return false;
  }
  if (isTesting) {
    return true;
  }
  if (!time) {
    return false;
  }
  const broadcastAt = Date.parse(time);
  if (Number.isNaN(broadcastAt)) {
    return false;
  }
  return now - broadcastAt >= RBF_PENDING_THRESHOLD_MS;
};
