// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { PillButton, PillButtonGroup } from '../../../components/pillbuttongroup/pillbuttongroup';
import { TMarketAction } from '@/api/market';


type TProps = {
  onChangeTab: (tab: TMarketAction) => void;
  activeTab: TMarketAction;
};


export const MarketTab = ({
  onChangeTab,
  activeTab
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
      <PillButton
        active={activeTab === 'swap'}
        onClick={() => onChangeTab('swap')}
      >
        {t('generic.swap')}
      </PillButton>
      <PillButton
        active={activeTab === 'otc'}
        onClick={() => onChangeTab('otc')}
      >
        {/* OTC doesn't need to be translated, but is explained in t('buy.exchange.otcInfo') */}
        OTC
      </PillButton>
    </PillButtonGroup>
  );
};
