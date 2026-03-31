// SPDX-License-Identifier: Apache-2.0

import type { CoinCode, CoinUnit, TAmountWithConversions } from '@/api/account';
import { getCoinFiatPrices, subscribeCoinFiatPrices } from '@/api/coins';
import { useSync } from '@/hooks/api';

/**
 * Fetches the fiat price of 1 unit of a coin in all fiat currencies.
 * Stays in sync via a backend subscription that pushes updated prices
 * whenever exchange rates change.
 */
export const useCoinUnitPrice = (
  coinCode: CoinCode,
  unit?: CoinUnit,
): TAmountWithConversions | undefined => {
  const result = useSync(
    () => getCoinFiatPrices(coinCode),
    subscribeCoinFiatPrices(coinCode),
  );
  if (!result || !unit) {
    return undefined;
  }
  return result;
};
