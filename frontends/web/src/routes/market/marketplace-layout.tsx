// SPDX-License-Identifier: Apache-2.0

import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { AccountCode, TAccount } from '@/api/account';
import { Header, GuidedContent, GuideWrapper, Main } from '@/components/layout';
import { isBitcoinOnly } from '@/routes/account/utils';
import { MarketGuide } from './guide';
import { MarketTab } from './components/markettab';
import { useMarketContext } from './market-context';
import { useMarketplaceTabNavigation } from './use-marketplace-tab-navigation';
import { getFallbackMarketAccountCode, getMarketActionFromSearchParams } from './utils';

type TProps = {
  accounts: TAccount[];
  children: ReactNode;
  code: AccountCode;
};

const MarketplaceLayoutContent = ({ accounts, children, code }: TProps) => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const { showSwap } = useMarketContext();

  const selectedAccountCode = code || getFallbackMarketAccountCode(accounts);
  const activeTab = getMarketActionFromSearchParams(searchParams);
  const hasOnlyBTCAccounts = accounts.every(({ coinCode }) => isBitcoinOnly(coinCode));
  const translationContext = hasOnlyBTCAccounts ? 'bitcoin' : 'crypto';
  const handleChangeTab = useMarketplaceTabNavigation(accounts, selectedAccountCode);

  return (
    <Main>
      <GuideWrapper>
        <GuidedContent>
          <Header title={<h2>{t('generic.buySell')}</h2>} />
          <MarketTab
            activeTab={activeTab}
            onChangeTab={handleChangeTab}
            showSwap={showSwap ?? false}
          />
          {children}
        </GuidedContent>
        <MarketGuide translationContext={translationContext} />
      </GuideWrapper>
    </Main>
  );
};

export const MarketplaceLayout = ({ accounts, children, code }: TProps) => {
  return (
    <MarketplaceLayoutContent
      accounts={accounts}
      code={code}
    >
      {children}
    </MarketplaceLayoutContent>
  );
};
