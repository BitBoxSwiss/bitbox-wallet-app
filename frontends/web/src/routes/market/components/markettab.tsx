/**
 * Copyright 2024 Shift Crypto AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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
    </PillButtonGroup>
  );
};
