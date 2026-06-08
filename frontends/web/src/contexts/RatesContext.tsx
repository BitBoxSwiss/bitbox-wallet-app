// SPDX-License-Identifier: Apache-2.0

import { createContext } from 'react';
import type { Fiat } from '@/api/account';
import type { BtcUnit } from '@/api/coins';

type RatesContextProps = {
  defaultCurrency: Fiat;
  activeCurrencies: Fiat[];
  btcUnit?: BtcUnit;
  rotateDefaultCurrency: () => Promise<void>;
  rotateBtcUnit: () => Promise<void>;
  addToActiveCurrencies: (fiat: Fiat) => Promise<void>;
  updateDefaultCurrency: (fiat: Fiat) => void;
  removeFromActiveCurrencies: (fiat: Fiat) => Promise<void>;
};

export const RatesContext = createContext<RatesContextProps>({} as RatesContextProps);
