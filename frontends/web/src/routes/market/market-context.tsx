// SPDX-License-Identifier: Apache-2.0

import { Dispatch, ReactNode, SetStateAction, createContext, useContext, useEffect, useState } from 'react';
import type { TAccount } from '@/api/account';
import { getSwapStatus } from '@/api/swap';
import { useLoad } from '@/hooks/api';
import type { TOption } from './components/countryselect';

type TMarketContext = {
  regions: TOption[];
  selectedRegion: string;
  setRegions: Dispatch<SetStateAction<TOption[]>>;
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
  const [regions, setRegions] = useState<TOption[]>([]);
  const [selectedRegion, setSelectedRegion] = useState('');
  const [showSwap, setShowSwap] = useState<boolean | undefined>();
  const swapStatus = useLoad(getSwapStatus, [accounts]);

  useEffect(() => {
    if (swapStatus?.available !== undefined) {
      setShowSwap(swapStatus.available);
    }
  }, [swapStatus?.available]);

  return (
    <MarketContext.Provider value={{
      regions,
      selectedRegion,
      setRegions,
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
