// SPDX-License-Identifier: Apache-2.0

import type { TAmountWithConversions } from '@/api/account';
import type { TLightningPayment } from '@/api/lightning';

export const isUnclaimedBitcoinDeposit = (payment: TLightningPayment) => (
  payment.bitcoinDeposit?.state === 'unclaimed'
);

const sumStrings = (values: (string | undefined)[]) => {
  const total = values.reduce((sum, value) => sum + Number(value || 0), 0);
  return Number.isFinite(total) ? String(total) : '';
};

// TODO: Replace with a backend-provided total once claiming is wired up, so the
// summing (and its rounding) does not happen in the frontend. Note that
// balance.incoming is not it: that sums every deposit returned by
// ListUnclaimedDeposits, including confirming and claiming ones.
export const sumAmounts = (amounts: TAmountWithConversions[]): TAmountWithConversions => {
  const currencies = new Set(
    amounts.flatMap(amount => Object.keys(amount.conversions || {}))
  );
  const conversions = Object.fromEntries(
    [...currencies].map(currency => [
      currency,
      sumStrings(amounts.map(amount => amount.conversions?.[currency as keyof typeof amount.conversions])),
    ])
  );
  return {
    amount: sumStrings(amounts.map(amount => amount.amount)),
    conversions,
    estimated: amounts.some(amount => amount.estimated),
    unit: amounts[0]?.unit || 'sat',
  };
};
