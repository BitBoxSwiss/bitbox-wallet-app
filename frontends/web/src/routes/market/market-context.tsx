// SPDX-License-Identifier: Apache-2.0

import { Dispatch, ReactNode, SetStateAction, createContext, useContext, useState } from 'react';
import type { TOption } from './components/countryselect';

type TMarketContext = {
  regions: TOption[];
  selectedRegion: string;
  setRegions: Dispatch<SetStateAction<TOption[]>>;
  setSelectedRegion: Dispatch<SetStateAction<string>>;
  setShowSwap: Dispatch<SetStateAction<boolean | undefined>>;
  showSwap?: boolean;
};

const MarketContext = createContext<TMarketContext | null>(null);

type TProps = {
  children: ReactNode;
};

export const MarketProvider = ({
  children,
}: TProps) => {
  const [regions, setRegions] = useState<TOption[]>([]);
  const [selectedRegion, setSelectedRegion] = useState('');
  const [showSwap, setShowSwap] = useState<boolean | undefined>();

  return (
    <MarketContext.Provider value={{
      regions,
      selectedRegion,
      setRegions,
      setSelectedRegion,
      setShowSwap,
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
