// SPDX-License-Identifier: Apache-2.0

import { createContext } from 'react';
import type { TFiat } from '@/api/account';
import type { BtcUnit } from '@/api/coins';

type RatesContextProps = {
  defaultCurrency: TFiat;
  activeCurrencies: TFiat[];
  btcUnit?: BtcUnit;
  rotateDefaultCurrency: () => Promise<void>;
  rotateBtcUnit: () => Promise<void>;
  addToActiveCurrencies: (fiat: TFiat) => Promise<void>;
  updateDefaultCurrency: (fiat: TFiat) => void;
  removeFromActiveCurrencies: (fiat: TFiat) => Promise<void>;
};

export const RatesContext = createContext<RatesContextProps>({} as RatesContextProps);
