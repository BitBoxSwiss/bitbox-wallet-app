// SPDX-License-Identifier: Apache-2.0

import { ReactNode, useEffect, useState } from 'react';
import { RatesContext } from './RatesContext';
import type { TFiat } from '@/api/account';
import { BtcUnit, setBtcUnit as setBackendBtcUnit } from '@/api/coins';
import { reconfigureHistoryRates } from '@/api/rates';
import { useConfig } from './ConfigProvider';
import { equal } from '@/utils/equal';

type TProps = {
  children: ReactNode;
};

export const RatesProvider = ({ children }: TProps) => {
  const { config, setConfig } = useConfig();
  const [defaultCurrency, setDefaultCurrency] = useState<TFiat>('USD');
  const [activeCurrencies, setActiveCurrencies] = useState<TFiat[]>(['USD', 'EUR', 'CHF']);
  const [btcUnit, setBtcUnit] = useState<BtcUnit>('default');

  useEffect(() => {
    if (config === undefined) {
      return;
    }
    setDefaultCurrency(config.backend.mainFiat);
    setActiveCurrencies(config.backend.fiatList);
    setBtcUnit(config.backend.btcUnit);
  }, [config]);

  const rotateDefaultCurrency = async () => {
    const index = activeCurrencies.indexOf(defaultCurrency);
    const fiat = activeCurrencies[(index + 1) % activeCurrencies.length] as TFiat;
    await updateDefaultCurrency(fiat);
  };

  // sets default currency both in config (mainFiat)
  // and in RatesContext context's (local) state
  const updateDefaultCurrency = async (fiat: TFiat) => {
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
  const addToActiveCurrencies = async (fiat: TFiat) => {
    const selected = [...activeCurrencies, fiat];
    await setConfig({ backend: { fiatList: selected } });
    handleChangeSelectedFiat(selected);
  };

  // this is a method to unselect / remove a currency
  // from the active currencies list
  const removeFromActiveCurrencies = async (fiat: TFiat) => {
    const selected = activeCurrencies.filter(item => !equal(item, fiat));
    await setConfig({ backend: { fiatList: selected } });
    handleChangeSelectedFiat(selected);
  };

  const handleChangeSelectedFiat = (selected: TFiat[]) => {
    setActiveCurrencies(selected);
    void reconfigureHistoryRates();
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
        removeFromActiveCurrencies,
        rotateBtcUnit,
      }}
    >
      {children}
    </RatesContext.Provider>
  );
};
