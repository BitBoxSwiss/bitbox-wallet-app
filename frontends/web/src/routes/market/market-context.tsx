// SPDX-License-Identifier: Apache-2.0

import { Dispatch, ReactNode, SetStateAction, createContext, useContext, useState } from 'react';
import type { TOption } from './components/countryselect';

type TMarketContext = {
  marketAccountCode?: string;
  regions: TOption[];
  selectedRegion: string;
  setMarketAccountCode: Dispatch<SetStateAction<string | undefined>>;
  setRegions: Dispatch<SetStateAction<TOption[]>>;
  setSelectedRegion: Dispatch<SetStateAction<string>>;
  setShowSwap: Dispatch<SetStateAction<boolean | undefined>>;
  showSwap?: boolean;
};

const MarketContext = createContext<TMarketContext | null>(null);

type TProps = {
  children: ReactNode;
  initialMarketAccountCode?: string;
};

export const MarketProvider = ({
  children,
  initialMarketAccountCode,
}: TProps) => {
  const [marketAccountCode, setMarketAccountCode] = useState<string | undefined>(initialMarketAccountCode);
  const [regions, setRegions] = useState<TOption[]>([]);
  const [selectedRegion, setSelectedRegion] = useState('');
  const [showSwap, setShowSwap] = useState<boolean | undefined>();

  return (
    <MarketContext.Provider value={{
      marketAccountCode,
      regions,
      selectedRegion,
      setMarketAccountCode,
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
