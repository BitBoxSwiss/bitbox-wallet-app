// SPDX-License-Identifier: Apache-2.0

import { useEffect } from 'react';
import type { TAccount } from '@/api/account';
import { getSwapStatus } from '@/api/swap';
import { useLoad } from '@/hooks/api';
import { MarketTab } from './markettab';
import type { TMarketplaceTab } from './markettab';
import { useMarketContext } from '../market-context';

type TProps = {
  accounts: TAccount[];
  activeTab: TMarketplaceTab;
  onChangeTab: (tab: TMarketplaceTab) => void;
};

export const MarketplaceNavigation = ({
  accounts,
  activeTab,
  onChangeTab,
}: TProps) => {
  const { setShowSwap, showSwap: contextShowSwap } = useMarketContext();
  const swapStatus = useLoad(getSwapStatus, [accounts]);
  const showSwapTab = swapStatus?.available ?? contextShowSwap ?? false;

  useEffect(() => {
    if (swapStatus?.available !== undefined) {
      setShowSwap(swapStatus.available);
    }
  }, [setShowSwap, swapStatus?.available]);

  return (
    <MarketTab
      activeTab={activeTab}
      onChangeTab={onChangeTab}
      showSwap={showSwapTab}
    />
  );
};
