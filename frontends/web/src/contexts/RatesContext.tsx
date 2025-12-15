// SPDX-License-Identifier: Apache-2.0

import { createContext } from 'react';
import { Fiat } from '@/api/account';
import { BtcUnit } from '@/api/coins';

type RatesContextProps = {
  defaultCurrency: Fiat;
  activeCurrencies: Fiat[];
  btcUnit?: BtcUnit;
  rotateDefaultCurrency: () => Promise<void>;
  rotateBtcUnit: () => Promise<void>;
  addToActiveCurrencies: (fiat: Fiat) => Promise<void>;
  updateDefaultCurrency: (fiat: Fiat) => void;
  updateRatesConfig: () => Promise<void>;
  removeFromActiveCurrencies: (fiat: Fiat) => Promise<void>;
};

const RatesContext = createContext<RatesContextProps>({} as RatesContextProps);

export { RatesContext };
