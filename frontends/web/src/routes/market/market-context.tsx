// SPDX-License-Identifier: Apache-2.0

import { Dispatch, ReactNode, SetStateAction, createContext, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TAccount } from '@/api/account';
import type { TOption } from './components/countryselect';
import { getSwapStatus } from '@/api/swap';
import { getMarketRegionCodes } from '@/api/market';
import { useLoad } from '@/hooks/api';
import { useConfig } from '@/contexts/ConfigProvider';
import { getRegionNameFromLocale } from '@/i18n/utils';
import { AppContext } from '@/contexts/AppContext';

type TMarketContext = {
  regions: TOption[];
  selectedRegion: string;
  setSelectedRegion: Dispatch<SetStateAction<string>>;
  showSwap?: boolean;
};

const MarketContext = createContext<TMarketContext | null>(null);

type TProps = {
  accounts: TAccount[];
  children: ReactNode;
};

export const MarketProvider = ({
  accounts,
  children,
}: TProps) => {
  const { i18n } = useTranslation();

  const [regions, setRegions] = useState<TOption[]>([]);
  const [selectedRegion, setSelectedRegion] = useState('');
  const [showSwap, setShowSwap] = useState<boolean | undefined>();

  const { config } = useConfig();
  const { nativeLocale } = useContext(AppContext);

  const swapStatus = useLoad(getSwapStatus, [accounts]);
  const regionCodes = useLoad(getMarketRegionCodes);

  // update region Select component when `regionList` or `config` gets populated.
  useEffect(() => {
    if (!regionCodes || !config) {
      return;
    }
    const regionNames = new Intl.DisplayNames([i18n.language], { type: 'region' });
    const regions: TOption[] = regionCodes.map(code => ({
      value: code,
      label: regionNames.of(code) || code
    }));

    regions.sort((a, b) => a.label.localeCompare(b.label, i18n.language));
    setRegions(regions);

    // if user had selected no region before, do not pre-select any.
    if (config.frontend.selectedExchangeRegion === '') {
      setSelectedRegion('');
      return;
    }

    if (config.frontend.selectedExchangeRegion) {
      // pre-select config region
      setSelectedRegion(config.frontend.selectedExchangeRegion);
      return;
    }

    // user never selected a region preference, will derive it from native locale.
    const userRegion = getRegionNameFromLocale(nativeLocale || '');
    // region is available in the list
    const regionAvailable = !!(regionCodes.find(code => code === userRegion));
    // pre-selecting the region
    const nextRegion = regionAvailable ? userRegion : '';
    setSelectedRegion(nextRegion);
  }, [regionCodes, config, nativeLocale, setRegions, setSelectedRegion, i18n.language]);


  useEffect(() => {
    if (swapStatus?.available !== undefined) {
      setShowSwap(swapStatus.available);
    }
  }, [swapStatus?.available]);

  return (
    <MarketContext.Provider value={{
      regions,
      selectedRegion,
      setSelectedRegion,
      showSwap,
    }}>
      {children}
    </MarketContext.Provider>
  );
};

export const useMarketContext = () => {
  const context = useContext(MarketContext);
  if (context === null) {
    throw new Error('useMarketContext must be used within MarketProvider');
  }
  return context;
};
