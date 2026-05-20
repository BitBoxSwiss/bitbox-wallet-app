// SPDX-License-Identifier: Apache-2.0

import { useEffect } from 'react';
import { Outlet, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TAccount } from '@/api/account';
import { Header, GuidedContent, GuideWrapper, Main } from '@/components/layout';
import { HideAmountsButton } from '@/components/hideamountsbutton/hideamountsbutton';
import { isBitcoinOnly } from '@/routes/account/utils';
import { BitsuranceGuide } from '@/routes/bitsurance/guide';
import { MarketGuide } from './guide';
import {
  getMarketActionFromSearchParams,
  MarketplaceNavigation,
} from './components/marketplace-navigation';
import type { TMarketplaceTab } from './components/markettab';
import { MarketProvider, useMarketContext } from './market-context';

type TProps = {
  accounts: TAccount[];
};

const MarketplaceLayoutContent = ({ accounts }: TProps) => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { code } = useParams();
  const [searchParams] = useSearchParams();
  const { marketAccountCode, setMarketAccountCode } = useMarketContext();

  const isBitsurance = pathname.startsWith('/market/bitsurance');
  const isMarketSelect = pathname.startsWith('/market/select');
  const showMarketplaceNavigation = !pathname.startsWith('/market/bitsurance/widget');
  const activeTab: TMarketplaceTab = isBitsurance ? 'insure' : getMarketActionFromSearchParams(searchParams);
  const hasOnlyBTCAccounts = accounts.every(({ coinCode }) => isBitcoinOnly(coinCode));
  const translationContext = hasOnlyBTCAccounts ? 'bitcoin' : 'crypto';

  useEffect(() => {
    if (isMarketSelect && code) {
      setMarketAccountCode(code);
    }
  }, [code, isMarketSelect, setMarketAccountCode]);

  const handleChangeTab = (tab: TMarketplaceTab) => {
    if (tab === 'insure') {
      const bitsurancePath = accounts.some(({ bitsuranceStatus }) => bitsuranceStatus)
        ? '/market/bitsurance/dashboard'
        : '/market/bitsurance';
      navigate(bitsurancePath);
      return;
    }
    const marketSelectAccountCode = isMarketSelect ? code || marketAccountCode : marketAccountCode;
    navigate(`/market/select${marketSelectAccountCode ? `/${marketSelectAccountCode}` : ''}?tab=${tab}`);
  };

  return (
    <Main>
      <GuideWrapper>
        <GuidedContent>
          <Header title={<h2>{t('generic.buySell')}</h2>}>
            {pathname.startsWith('/market/bitsurance/dashboard') && (
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
          <Outlet />
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

export const MarketplaceLayout = ({ accounts }: TProps) => {
  const { pathname } = useLocation();
  const { code } = useParams();
  const isMarketSelect = pathname.startsWith('/market/select');

  return (
    <MarketProvider initialMarketAccountCode={isMarketSelect ? code : undefined}>
      <MarketplaceLayoutContent accounts={accounts} />
    </MarketProvider>
  );
};
