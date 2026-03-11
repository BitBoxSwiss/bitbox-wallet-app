// SPDX-License-Identifier: Apache-2.0

import { useContext, useEffect, useState } from 'react';
import type { CoinCode, CoinUnit, TAmountWithConversions } from '@/api/account';
import { convertToCurrency } from '@/api/coins';
import { RatesContext } from '@/contexts/RatesContext';
import { useMountedRef } from '@/hooks/mount';

/**
 * Fetches the fiat price of 1 unit of a coin in the user's selected currency.
 * Returns a TAmountWithConversions suitable for AmountWithUnit with convertToFiat.
 */
export const useCoinUnitPrice = (
  coinCode: CoinCode,
  unit?: CoinUnit,
): TAmountWithConversions | undefined => {
  const { defaultCurrency } = useContext(RatesContext);
  const [unitPrice, setUnitPrice] = useState<TAmountWithConversions>();
  const mounted = useMountedRef();

  useEffect(() => {
    if (!unit) {
      return;
    }
    setUnitPrice(undefined);
    convertToCurrency({
      amount: '1',
      coinCode,
      fiatUnit: defaultCurrency,
    }).then(data => {
      if (mounted.current && data.success) {
        setUnitPrice({
          amount: '1',
          unit,
          conversions: { [defaultCurrency]: data.fiatAmount },
          estimated: false,
        });
      }
    }).catch(() => {
      console.error('Error fetching coin unit price');
    });
  }, [coinCode, unit, defaultCurrency, mounted]);

  return unitPrice;
};
