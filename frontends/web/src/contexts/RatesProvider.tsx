// SPDX-License-Identifier: Apache-2.0

import { ReactNode, useEffect, useState } from 'react';
import { RatesContext } from './RatesContext';
import { Fiat } from '@/api/account';
import { BtcUnit, setBtcUnit as setBackendBtcUnit } from '@/api/coins';
import { getConfig, setConfig } from '@/utils/config';
import { reinitializeAccounts } from '@/api/backend';
import { equal } from '@/utils/equal';

type TProps = {
  children: ReactNode;
};

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

  const rotateDefaultCurrency = async () => {
    const index = activeCurrencies.indexOf(defaultCurrency);
    const fiat = activeCurrencies[(index + 1) % activeCurrencies.length] as Fiat;
    await updateDefaultCurrency(fiat);
  };

  // sets default currency both in config (mainFiat)
  // and in RatesContext context's (local) state
  const updateDefaultCurrency = async (fiat: Fiat) => {
    if (!activeCurrencies.includes(fiat)) {
      addToActiveCurrencies(fiat);
    }
    await setConfig({ backend: { mainFiat: fiat } });
    setDefaultCurrency(fiat);
  };

  const rotateBtcUnit = async () => {
    const unit: BtcUnit = btcUnit === 'default' ? 'sat' : 'default';
    await setConfig({ backend: { btcUnit: unit } });
    setBtcUnit(unit);
    const response = await setBackendBtcUnit(unit);
    if (!response.success) {
      console.log('setBackendBtcUnit failed.');
    }
  };

  // this is a method to select / add a currency
  // into the active currencies list
  const addToActiveCurrencies = async (fiat: Fiat) => {
    const selected = [...activeCurrencies, fiat];
    await setConfig({ backend: { fiatList: selected } });
    handleChangeSelectedFiat(selected);
  };

  // this is a method to unselect / remove a currency
  // from the active currencies list
  const removeFromActiveCurrencies = async (fiat: Fiat) => {
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
        rotateDefaultCurrency,
        addToActiveCurrencies,
        updateDefaultCurrency,
        updateRatesConfig,
        removeFromActiveCurrencies,
        rotateBtcUnit,
      }}
    >
      {children}
    </RatesContext.Provider>
  );
};
