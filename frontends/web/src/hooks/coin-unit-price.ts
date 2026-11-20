// SPDX-License-Identifier: Apache-2.0

import type { TCoinCode, TCoinUnit, TAmountWithConversions } from '@/api/account';
import { getCoinFiatPrices, subscribeCoinFiatPrices } from '@/api/coins';
import { useSync } from '@/hooks/api';

/**
 * Fetches the fiat price of 1 unit of a coin in all fiat currencies.
 * Stays in sync via a backend subscription that pushes updated prices
 * whenever exchange rates change.
 */
export const useCoinUnitPrice = (
  coinCode: TCoinCode,
  unit?: TCoinUnit,
): TAmountWithConversions | undefined => {
  const unitPriceCoinCode = coinCode === 'lightning' ? 'btc' : coinCode;
  const result = useSync(
    () => getCoinFiatPrices(unitPriceCoinCode),
    subscribeCoinFiatPrices(unitPriceCoinCode),
  );
  if (!result || !unit) {
    return undefined;
  }
  return result;
};
