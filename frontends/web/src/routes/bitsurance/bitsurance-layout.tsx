// SPDX-License-Identifier: Apache-2.0

import { useEffect, type ReactNode } from 'react';
import { matchPath, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TAccount } from '@/api/account';
import { Header, GuidedContent, GuideWrapper, Main } from '@/components/layout';
import { HideAmountsButton } from '@/components/hideamountsbutton/hideamountsbutton';
import { MarketplaceNavigation } from '@/routes/market/components/marketplace-navigation';
import { useMarketplaceTabNavigation } from '@/routes/market/use-marketplace-tab-navigation';
import { getFallbackMarketAccountCode } from '@/routes/market/utils';
import { getBitsurancePathWithAccountCode, getRouteBitsuranceAccountCode } from './utils';
import { BitsuranceGuide } from './guide';

type TProps = {
  accounts: TAccount[];
  children: ReactNode;
};

const BitsuranceLayoutContent = ({ accounts, children }: TProps) => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const routeMarketAccountCode = getRouteBitsuranceAccountCode(pathname);
  const selectedAccountCode = routeMarketAccountCode || getFallbackMarketAccountCode(accounts);
  const isBitsuranceDashboard = !!matchPath({ path: '/market/bitsurance/dashboard/:code', end: true }, pathname);
  const normalizedBitsurancePath = selectedAccountCode
    ? getBitsurancePathWithAccountCode(pathname, selectedAccountCode)
    : '';
  const shouldNormalizeBitsurancePath = !!normalizedBitsurancePath
    && pathname !== normalizedBitsurancePath;

  useEffect(() => {
    if (shouldNormalizeBitsurancePath) {
      navigate(normalizedBitsurancePath, { replace: true });
    }
  }, [navigate, normalizedBitsurancePath, shouldNormalizeBitsurancePath]);

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
          <MarketplaceNavigation
            activeTab="insure"
            onChangeTab={handleChangeTab}
          />
          {children}
        </GuidedContent>
        <BitsuranceGuide />
      </GuideWrapper>
    </Main>
  );
};

export const BitsuranceLayout = ({ accounts, children }: TProps) => {
  return (
    <BitsuranceLayoutContent accounts={accounts}>
      {children}
    </BitsuranceLayoutContent>
  );
};

export const BitsuranceWidgetLayout = ({ children }: { children: ReactNode }) => {
  const { t } = useTranslation();

  return (
    <Main>
      <GuideWrapper>
        <GuidedContent>
          <Header title={<h2>{t('generic.buySell')}</h2>} />
          {children}
        </GuidedContent>
        <BitsuranceGuide />
      </GuideWrapper>
    </Main>
  );
};
