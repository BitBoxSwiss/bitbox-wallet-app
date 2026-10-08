// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { useLocation } from 'wouter';
import type { AccountCode } from '@/api/account';
import type { TMarketAction } from '@/api/market';
import { useAppState } from '@/contexts/app-state-context';
import { useMarketContext } from '@/routes/market/market-context';
import { PillButton, PillButtonGroup } from '@/components/pillbuttongroup/pillbuttongroup';
import { NewBadge } from '@/components/new-badge/new-badge';
import style from './markettab.module.css';

export type TMarketplaceTab = TMarketAction | 'insure';

type TProps = {
  activeTab: TMarketplaceTab;
  code: AccountCode;
};

export const MarketTab = ({
  activeTab,
  code,
}: TProps) => {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const { activeAccounts } = useAppState();
  const { showSwap } = useMarketContext();

  const onChangeTab = (tab: TMarketplaceTab) => {
    if (tab === 'insure') {
      navigate(
        activeAccounts.some(({ bitsuranceStatus }) => bitsuranceStatus)
          ? `/market/bitsurance/dashboard/${code}`
          : `/market/bitsurance/${code}`
      );
      return;
    }
    navigate(`/market/select/${code}?tab=${tab}`);
  };

  return (
    <PillButtonGroup className={style.navigation} size="large">
      <PillButton
        active={activeTab === 'buy'}
        onClick={() => onChangeTab('buy')}
      >
        {t('buy.exchange.buy')}
      </PillButton>
      <PillButton
        active={activeTab === 'sell'}
        onClick={() => onChangeTab('sell')}
      >
        {t('buy.exchange.sell')}
      </PillButton>
      <PillButton
        active={activeTab === 'spend'}
        onClick={() => onChangeTab('spend')}
      >
        {t('buy.exchange.spend')}
      </PillButton>
      {showSwap && (
        <PillButton
          active={activeTab === 'swap'}
          onClick={() => onChangeTab('swap')}
        >
          <span className={style.tabLabel}>
            {t('generic.swap')}
            <NewBadge
              className={style.newBadge}
              configKey="hasSeenSwapMarketTab"
              markAsSeen={activeTab === 'swap'}
              testID="swap-new-badge"
            />
          </span>
        </PillButton>
      )}
      <PillButton
        active={activeTab === 'otc'}
        onClick={() => onChangeTab('otc')}
      >
        <span className={style.tabLabel}>
          {/* OTC doesn't need to be translated, but is explained in t('buy.exchange.otcInfo') */}
          OTC
          <NewBadge
            className={style.newBadge}
            configKey="hasSeenOtcMarketTab"
            markAsSeen={activeTab === 'otc'}
            testID="otc-new-badge"
          />
        </span>
      </PillButton>
      <PillButton
        active={activeTab === 'insure'}
        onClick={() => onChangeTab('insure')}
      >
        {t('generic.insure')}
      </PillButton>
    </PillButtonGroup>
  );
};
