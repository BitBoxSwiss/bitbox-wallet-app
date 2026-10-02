// SPDX-License-Identifier: Apache-2.0

import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { AccountCode, TAccount } from '@/api/account';
import type { TMarketAction } from '@/api/market';
import { useMarketContext } from '@/routes/market/market-context';
import { PillButton, PillButtonGroup } from '@/components/pillbuttongroup/pillbuttongroup';
import { NewBadge } from '@/components/new-badge/new-badge';
import { getFallbackMarketAccountCode } from '../utils';
import { useLightning } from '@/hooks/lightning';
import style from './markettab.module.css';

export type TMarketplaceTab = TMarketAction | 'insure';

type TProps = {
  accounts: TAccount[];
  activeTab: TMarketplaceTab;
  code: AccountCode;
};

export const MarketTab = ({
  accounts,
  activeTab,
  code,
}: TProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showSwap } = useMarketContext();
  const { lightningAccount } = useLightning();
  const onlyLightning = !!lightningAccount && accounts.length === 0;

  const onChangeTab = (tab: TMarketplaceTab) => {
    if (tab === 'insure') {
      const accountCode = code === lightningAccount?.code ? getFallbackMarketAccountCode(accounts) : code;
      navigate(
        accounts.some(({ bitsuranceStatus }) => bitsuranceStatus)
          ? `/market/bitsurance/dashboard/${accountCode}`
          : `/market/bitsurance/${accountCode}`
      );
      return;
    }
    navigate(`/market/select/${code}?tab=${tab}`);
  };

  return (
    <PillButtonGroup className={style.navigation} size="large">
      {!onlyLightning && (
        <>
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
        </>
      )}
      <PillButton
        active={activeTab === 'spend'}
        onClick={() => onChangeTab('spend')}
      >
        {t('buy.exchange.spend')}
      </PillButton>
      {!onlyLightning && (
        <>
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
        </>
      )}
    </PillButtonGroup>
  );
};
