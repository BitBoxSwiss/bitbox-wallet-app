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

import { ReactNode, useEffect, useState } from 'react';
import { RatesContext } from './RatesContext';
import { Fiat } from '../api/account';
import { BtcUnit } from '../api/coins';
import { getConfig, setConfig } from '../utils/config';
import { reinitializeAccounts } from '../api/backend';
import { equal } from '../utils/equal';

type TProps = {
    children: ReactNode;
}

export const RatesProvider = ({ children }: TProps) => {
  const [defaultCurrency, setDefaultCurrency] = useState<Fiat>('USD');
  const [activeCurrencies, setActiveCurrencies] = useState<Fiat[]>(['USD', 'EUR', 'CHF']);
  const [btcUnit, setBtcUnit] = useState<BtcUnit>('default');

  useEffect(() => {
    updateRatesConfig();
  }, []);

  const updateRatesConfig = async () => {
    const appConf = await getConfig();

    if (appConf.backend?.mainFiat) {
      setDefaultCurrency(appConf.backend.mainFiat);
    }

    if (appConf.backend?.fiatList && appConf.backend?.btcUnit) {
      setActiveCurrencies(appConf.backend.fiatList);
      setBtcUnit(appConf.backend.btcUnit);
    }
  };

  const rotateFiat = () => {
    const index = activeCurrencies.indexOf(defaultCurrency);
    const fiat = activeCurrencies[(index + 1) % activeCurrencies.length];
    setDefaultCurrency(fiat);
  };

  const updateDefaultFiat = (fiat: Fiat) => {
    if (!activeCurrencies.includes(fiat)) {
      selectFiat(fiat);
    }
    setDefaultCurrency(fiat);
    setConfig({ backend: { mainFiat: fiat } });
  };

  //this is a method to select a fiat to be
  //added into the selected fiat list
  const selectFiat = async (fiat: Fiat) => {
    const selected = [...activeCurrencies, fiat];
    await setConfig({ backend: { fiatList: selected } });
    handleChangeSelectedFiat(selected);
  };

  //this is a method to unselect a fiat to be
  //removed from the selected fiat list
  const unselectFiat = async (fiat: Fiat) => {
    const selected = activeCurrencies.filter(item => !equal(item, fiat));
    await setConfig({ backend: { fiatList: selected } });
    handleChangeSelectedFiat(selected);
  };

  const handleChangeSelectedFiat = (selected: Fiat[]) => {
    setActiveCurrencies(selected);
    // Need to reconfigure currency exchange rates updater
    // which is done during accounts reset.
    reinitializeAccounts();
  };

  return (
    <RatesContext.Provider
      value={{
        defaultCurrency,
        activeCurrencies,
        btcUnit,
        rotateFiat,
        selectFiat,
        updateDefaultFiat,
        updateRatesConfig,
        unselectFiat
      }}
    >
      {children}
    </RatesContext.Provider>
  );
};