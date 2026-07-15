// SPDX-License-Identifier: Apache-2.0

import type { CoinUnit, ConversionUnit } from '@/api/account';

export const CONTENT_MIN_HEIGHT = '38em';

export type TDisplayAmount = {
  amount: string;
  fiatAmount: string;
};

export const MOCK_AMOUNT_UNIT: CoinUnit = 'sat';
export const MOCK_FIAT_UNIT: ConversionUnit = 'EUR';

export const MOCK_LIGHTNING_BALANCE: TDisplayAmount = {
  amount: '10000',
  fiatAmount: '64.0',
};

export const MOCK_WITHDRAW_FEE: TDisplayAmount = {
  amount: '1000',
  fiatAmount: '6.40',
};
