// SPDX-License-Identifier: Apache-2.0

import type { ReactNode } from 'react';
import { matchPath, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TAccount } from '@/api/account';
import { Header, GuidedContent, GuideWrapper, Main } from '@/components/layout';
import { HideAmountsButton } from '@/components/hideamountsbutton/hideamountsbutton';
import { isBitcoinOnly } from '@/routes/account/utils';
import { BitsuranceGuide } from '@/routes/bitsurance/guide';
import { MarketGuide } from './guide';
import { MarketplaceNavigation } from './components/marketplace-navigation';
import type { TMarketplaceTab } from './components/markettab';
import { MarketProvider } from './market-context';
import { getMarketActionFromSearchParams } from './utils';

type TProps = {
  accounts: TAccount[];
  children: ReactNode;
};

const reservedBitsuranceRoutes = ['account', 'dashboard', 'widget'];
const bitsurancePathPrefix = '/market/bitsurance';

const getRouteMarketAccountCode = (pathname: string): string | undefined => {
  const marketSelectMatch = matchPath({ path: '/market/select/:code', end: true }, pathname);
  if (marketSelectMatch?.params.code) {
    return marketSelectMatch.params.code;
  }

  const bitsuranceIntroMatch = matchPath({ path: '/market/bitsurance/:code', end: true }, pathname);
  if (bitsuranceIntroMatch?.params.code && !reservedBitsuranceRoutes.includes(bitsuranceIntroMatch.params.code)) {
    return bitsuranceIntroMatch.params.code;
  }

  const bitsuranceStepMatch = matchPath({ path: '/market/bitsurance/:step/:code', end: true }, pathname);
  if (
    bitsuranceStepMatch?.params.step
    && reservedBitsuranceRoutes.includes(bitsuranceStepMatch.params.step)
    && bitsuranceStepMatch.params.code
  ) {
    return bitsuranceStepMatch.params.code;
  }
  return undefined;
};

const getFallbackAccountCode = (accounts: TAccount[]) => {
  return accounts.find(account => account.keystore.connected)?.code
    || accounts[0]?.code
    || '';
};

const getBitsurancePathWithAccountCode = (
  pathname: string,
  accountCode: string,
) => {
  const normalizedIntroMatch = matchPath({ path: '/market/bitsurance/:code', end: true }, pathname);
  if (normalizedIntroMatch?.params.code && !reservedBitsuranceRoutes.includes(normalizedIntroMatch.params.code)) {
    return pathname;
  }
  const normalizedStepMatch = matchPath({ path: '/market/bitsurance/:step/:code', end: true }, pathname);
  if (
    normalizedStepMatch?.params.step
    && reservedBitsuranceRoutes.includes(normalizedStepMatch.params.step)
    && normalizedStepMatch.params.code
  ) {
    return pathname;
  }
  if (matchPath({ path: '/market/bitsurance/account', end: true }, pathname)) {
    return `${bitsurancePathPrefix}/account/${accountCode}`;
  }
  if (matchPath({ path: '/market/bitsurance/widget', end: true }, pathname)) {
    return `${bitsurancePathPrefix}/widget/${accountCode}`;
  }
  if (matchPath({ path: '/market/bitsurance/dashboard', end: true }, pathname)) {
    return `${bitsurancePathPrefix}/dashboard/${accountCode}`;
  }
  return `${bitsurancePathPrefix}/${accountCode}`;
};

const MarketplaceLayoutContent = ({ accounts, children }: TProps) => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const isBitsurance = pathname.startsWith('/market/bitsurance');
  const routeMarketAccountCode = getRouteMarketAccountCode(pathname);
  const selectedAccountCode = routeMarketAccountCode || getFallbackAccountCode(accounts);
  const isBitsuranceDashboard = !!matchPath({ path: '/market/bitsurance/dashboard/:code', end: true }, pathname);
  const isBitsuranceWidget = !!matchPath({ path: '/market/bitsurance/widget/:code', end: true }, pathname);
  const showMarketplaceNavigation = !isBitsuranceWidget;
  const activeTab: TMarketplaceTab = isBitsurance
    ? 'insure'
    : getMarketActionFromSearchParams(searchParams);
  const hasOnlyBTCAccounts = accounts.every(({ coinCode }) => isBitcoinOnly(coinCode));
  const translationContext = hasOnlyBTCAccounts ? 'bitcoin' : 'crypto';
  const normalizedBitsurancePath = isBitsurance && selectedAccountCode
    ? getBitsurancePathWithAccountCode(pathname, selectedAccountCode)
    : '';
  const shouldNormalizeBitsurancePath = isBitsurance
    && !!normalizedBitsurancePath
    && pathname !== normalizedBitsurancePath;

  if (shouldNormalizeBitsurancePath) {
    return <Navigate to={normalizedBitsurancePath} replace />;
  }

  const handleChangeTab = (tab: TMarketplaceTab) => {
    if (tab === 'insure') {
      const bitsurancePath = accounts.some(({ bitsuranceStatus }) => bitsuranceStatus)
        ? `${bitsurancePathPrefix}/dashboard${selectedAccountCode ? `/${selectedAccountCode}` : ''}`
        : `${bitsurancePathPrefix}${selectedAccountCode ? `/${selectedAccountCode}` : ''}`;
      navigate(bitsurancePath);
      return;
    }
    const marketSelectPath = selectedAccountCode ? `/market/select/${selectedAccountCode}` : '/market/select';
    navigate(`${marketSelectPath}?tab=${tab}`);
  };

  return (
    <Main>
      <GuideWrapper>
        <GuidedContent>
          <Header title={<h2>{t('generic.buySell')}</h2>}>
            {isBitsuranceDashboard && (
              <HideAmountsButton />
            )}
          </Header>
          {showMarketplaceNavigation && (
            <MarketplaceNavigation
              accounts={accounts}
              activeTab={activeTab}
              onChangeTab={handleChangeTab}
            />
          )}
          {children}
        </GuidedContent>
        {isBitsurance ? (
          <BitsuranceGuide />
        ) : (
          <MarketGuide translationContext={translationContext} />
        )}
      </GuideWrapper>
    </Main>
  );
};

export const MarketplaceLayout = ({ accounts, children }: TProps) => {
  return (
    <MarketProvider>
      <MarketplaceLayoutContent accounts={accounts}>
        {children}
      </MarketplaceLayoutContent>
    </MarketProvider>
  );
};
