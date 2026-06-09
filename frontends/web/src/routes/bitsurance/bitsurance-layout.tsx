// SPDX-License-Identifier: Apache-2.0

import type { ReactNode } from 'react';
import { matchPath, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { AccountCode, TAccount } from '@/api/account';
import { Header, GuidedContent, GuideWrapper, Main } from '@/components/layout';
import { HideAmountsButton } from '@/components/hideamountsbutton/hideamountsbutton';
import { MarketTab } from '@/routes/market/components/markettab';
import { useMarketContext } from '@/routes/market/market-context';
import { useMarketplaceTabNavigation } from '@/routes/market/use-marketplace-tab-navigation';
import { getFallbackMarketAccountCode } from '@/routes/market/utils';
import { BitsuranceGuide } from './guide';

type TProps = {
  accounts: TAccount[];
  children: ReactNode;
  code: AccountCode;
};

export const BitsuranceLayout = ({ accounts, children, code }: TProps) => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { showSwap } = useMarketContext();

  const selectedAccountCode = code || getFallbackMarketAccountCode(accounts);
  const isBitsuranceDashboard = !!matchPath({ path: '/market/bitsurance/dashboard/:code', end: true }, pathname);

  const handleChangeTab = useMarketplaceTabNavigation(accounts, selectedAccountCode);

  return (
    <Main>
      <GuideWrapper>
        <GuidedContent>
          <Header title={<h2>{t('generic.buySell')}</h2>}>
            {isBitsuranceDashboard && (
              <HideAmountsButton />
            )}
          </Header>
          <MarketTab
            activeTab="insure"
            onChangeTab={handleChangeTab}
            showSwap={showSwap ?? false}
          />
          {children}
        </GuidedContent>
        <BitsuranceGuide />
      </GuideWrapper>
    </Main>
  );
};
