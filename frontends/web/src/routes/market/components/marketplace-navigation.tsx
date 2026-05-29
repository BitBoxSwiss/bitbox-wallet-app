// SPDX-License-Identifier: Apache-2.0

import { MarketTab } from './markettab';
import type { TMarketplaceTab } from './markettab';
import { useMarketContext } from '../market-context';

type TProps = {
  activeTab: TMarketplaceTab;
  onChangeTab: (tab: TMarketplaceTab) => void;
};

export const MarketplaceNavigation = ({
  activeTab,
  onChangeTab,
}: TProps) => {
  const { showSwap } = useMarketContext();

  return (
    <MarketTab
      activeTab={activeTab}
      onChangeTab={onChangeTab}
      showSwap={showSwap ?? false}
    />
  );
};
