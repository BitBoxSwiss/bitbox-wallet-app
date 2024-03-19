/**
 * Copyright 2023 Shift Crypto AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
*
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { createContext } from 'react';
import { Fiat } from '../api/account';
import { BtcUnit } from '../api/coins';

type RatesContextProps = {
    defaultCurrency: Fiat;
    activeCurrencies: Fiat[];
    btcUnit?: BtcUnit;
    rotateDefaultCurrency: () => Promise<void>;
    addToActiveCurrencies: (fiat: Fiat) => Promise<void>;
    updateDefaultCurrency: (fiat: Fiat) => void;
    updateRatesConfig: () => Promise<void>;
    removeFromActiveCurrencies: (fiat: Fiat) => Promise<void>;
}

const RatesContext = createContext<RatesContextProps>({} as RatesContextProps);

export { RatesContext };
