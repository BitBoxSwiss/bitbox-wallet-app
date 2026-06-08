// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { PillButton, PillButtonGroup } from '../../../components/pillbuttongroup/pillbuttongroup';
import { TMarketAction } from '@/api/market';
import { NewBadge } from '@/components/new-badge/new-badge';
import style from './markettab.module.css';


type TProps = {
  onChangeTab: (tab: TMarketAction) => void;
  activeTab: TMarketAction;
  showSwap: boolean;
};


export const MarketTab = ({
  onChangeTab,
  activeTab,
  showSwap,
}: TProps) => {
  const { t } = useTranslation();
  return (
    <PillButtonGroup size="large">
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
    </PillButtonGroup>
  );
};
