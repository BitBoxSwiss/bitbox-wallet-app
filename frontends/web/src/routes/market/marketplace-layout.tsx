// SPDX-License-Identifier: Apache-2.0

import type { ReactNode } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TAccount } from '@/api/account';
import { Header, GuidedContent, GuideWrapper, Main } from '@/components/layout';
import { isBitcoinOnly } from '@/routes/account/utils';
import { MarketGuide } from './guide';
import { MarketplaceNavigation } from './components/marketplace-navigation';
import { useMarketplaceTabNavigation } from './use-marketplace-tab-navigation';
import { getFallbackMarketAccountCode, getMarketActionFromSearchParams, getRouteMarketAccountCode } from './utils';

type TProps = {
  accounts: TAccount[];
  children: ReactNode;
};

const MarketplaceLayoutContent = ({ accounts, children }: TProps) => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();

  const routeMarketAccountCode = getRouteMarketAccountCode(pathname);
  const selectedAccountCode = routeMarketAccountCode || getFallbackMarketAccountCode(accounts);
  const activeTab = getMarketActionFromSearchParams(searchParams);
  const hasOnlyBTCAccounts = accounts.every(({ coinCode }) => isBitcoinOnly(coinCode));
  const translationContext = hasOnlyBTCAccounts ? 'bitcoin' : 'crypto';
  const handleChangeTab = useMarketplaceTabNavigation(accounts, selectedAccountCode);

  return (
    <Main>
      <GuideWrapper>
        <GuidedContent>
          <Header title={<h2>{t('generic.buySell')}</h2>} />
          <MarketplaceNavigation
            activeTab={activeTab}
            onChangeTab={handleChangeTab}
          />
          {children}
        </GuidedContent>
        <MarketGuide translationContext={translationContext} />
      </GuideWrapper>
    </Main>
  );
};

export const MarketplaceLayout = ({ accounts, children }: TProps) => {
  return (
    <MarketplaceLayoutContent accounts={accounts}>
      {children}
    </MarketplaceLayoutContent>
  );
};
