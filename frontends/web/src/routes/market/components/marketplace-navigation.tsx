// SPDX-License-Identifier: Apache-2.0

import { useEffect } from 'react';
import type { TAccount } from '@/api/account';
import { getSwapStatus } from '@/api/swap';
import { useLoad } from '@/hooks/api';
import { MarketTab } from './markettab';
import type { TMarketplaceTab } from './markettab';
import type { TMarketAction } from '@/api/market';
import style from './markettab.module.css';

type TProps = {
  accounts?: TAccount[];
  activeTab: TMarketplaceTab;
  className?: string;
  onChangeTab: (tab: TMarketplaceTab) => void;
  showSwap?: boolean;
};

let cachedShowSwap: boolean | undefined;

export const getInsurancePath = (accounts?: TAccount[]) => {
  return accounts?.some(({ bitsuranceStatus }) => bitsuranceStatus)
    ? '/market/bitsurance/dashboard'
    : '/market/bitsurance';
};

export const getMarketActionFromSearchParams = (searchParams: URLSearchParams): TMarketAction => {
  const tab = searchParams.get('tab');
  if (tab === 'buy' || tab === 'sell' || tab === 'spend' || tab === 'swap' || tab === 'otc') {
    return tab;
  }
  return 'buy';
};

export const getMarketSelectPath = (tab: TMarketAction, code?: string) => {
  return `/market/select${code ? `/${code}` : ''}?tab=${tab}`;
};

export const MarketplaceNavigation = ({
  accounts,
  activeTab,
  className = '',
  onChangeTab,
  showSwap,
}: TProps) => {
  const swapStatus = useLoad(showSwap === undefined ? getSwapStatus : null, [accounts]);
  const showSwapTab = showSwap ?? swapStatus?.available ?? cachedShowSwap ?? false;

  useEffect(() => {
    const nextShowSwap = showSwap ?? swapStatus?.available;
    if (nextShowSwap !== undefined) {
      cachedShowSwap = nextShowSwap;
    }
  }, [showSwap, swapStatus?.available]);

  return (
    <MarketTab
      activeTab={activeTab}
      className={`${style.navigation || ''} ${className}`}
      onChangeTab={onChangeTab}
      showSwap={showSwapTab}
    />
  );
};
