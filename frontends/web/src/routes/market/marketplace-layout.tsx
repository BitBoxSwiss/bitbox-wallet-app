// SPDX-License-Identifier: Apache-2.0

import { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TAccount } from '@/api/account';
import { Header, GuidedContent, GuideWrapper, Main } from '@/components/layout';
import { HideAmountsButton } from '@/components/hideamountsbutton/hideamountsbutton';
import { isBitcoinOnly } from '@/routes/account/utils';
import { BitsuranceGuide } from '@/routes/bitsurance/guide';
import { MarketGuide } from './guide';
import {
  getInsurancePath,
  getMarketActionFromSearchParams,
  getMarketSelectPath,
  MarketplaceNavigation,
} from './components/marketplace-navigation';
import type { TOption } from './components/countryselect';
import type { TMarketplaceTab } from './components/markettab';

type TProps = {
  accounts: TAccount[];
};

export type TMarketplaceOutletContext = {
  marketAccountCode?: string;
  regions: TOption[];
  selectedRegion: string;
  setMarketAccountCode: (accountCode: string) => void;
  setRegions: (regions: TOption[]) => void;
  setSelectedRegion: (region: string) => void;
};

export const MarketplaceLayout = ({ accounts }: TProps) => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { code } = useParams();
  const [searchParams] = useSearchParams();

  const isBitsurance = pathname.startsWith('/market/bitsurance');
  const isMarketSelect = pathname.startsWith('/market/select');
  const showMarketplaceNavigation = !pathname.startsWith('/market/bitsurance/widget');
  const [marketAccountCode, setMarketAccountCode] = useState(isMarketSelect ? code : undefined);
  const [regions, setRegions] = useState<TOption[]>([]);
  const [selectedRegion, setSelectedRegion] = useState('');
  const activeTab: TMarketplaceTab = isBitsurance ? 'insure' : getMarketActionFromSearchParams(searchParams);
  const hasOnlyBTCAccounts = accounts.every(({ coinCode }) => isBitcoinOnly(coinCode));
  const translationContext = hasOnlyBTCAccounts ? 'bitcoin' : 'crypto';

  useEffect(() => {
    if (isMarketSelect && code) {
      setMarketAccountCode(code);
    }
  }, [code, isMarketSelect]);

  const outletContext = useMemo<TMarketplaceOutletContext>(() => ({
    marketAccountCode,
    regions,
    selectedRegion,
    setMarketAccountCode,
    setRegions,
    setSelectedRegion,
  }), [marketAccountCode, regions, selectedRegion]);

  const handleChangeTab = (tab: TMarketplaceTab) => {
    if (tab === 'insure') {
      navigate(getInsurancePath(accounts));
      return;
    }
    navigate(getMarketSelectPath(tab, isMarketSelect ? code || marketAccountCode : marketAccountCode));
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
          <Outlet context={outletContext} />
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
