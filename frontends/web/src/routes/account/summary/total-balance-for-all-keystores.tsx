// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import * as accountApi from '@/api/account';
import { Skeleton } from '@/components/skeleton/skeleton';
import { AssetBalance } from './asset-balance';
import { BalanceSection } from './balance-section';
import style from './accountssummary.module.css';

type TProps = {
  summaryData?: accountApi.TChartData;
  coinsBalances?: accountApi.CoinFormattedAmount[];
};

export const TotalBalanceForAllKeystores = ({
  summaryData,
  coinsBalances = [],
}: TProps) => {
  const { t } = useTranslation();
  return (
    <BalanceSection
      name={<span>{t('accountSummary.totalAssets')}</span>}
      totalAmount={summaryData?.formattedChartTotal ?? undefined}
      fiatUnit={summaryData?.chartFiat}
    >
      {coinsBalances.length > 0 ? coinsBalances.map((balance) => (
        <div key={balance.coinCode} className={style.coinGroupCard}>
          <AssetBalance
            amount={balance.formattedAmount}
            coinCode={balance.coinCode}
            coinName={balance.coinName}
          />
        </div>
      )) : (
        <LoadingSkeleton />
      )}
    </BalanceSection>
  );
};


const LoadingSkeleton = () => {
  return (
    <>
      <div className={style.coinGroupCard}>
        <div className={style.assetBalanceRow}>
          <div className={style.assetBalanceInfo}>
            <Skeleton minWidth="40px" fontSize="40px" />
            <Skeleton minWidth="80px" />
          </div>
          <div className={style.assetBalanceAmounts}>
            <Skeleton minWidth="60px" />
            <Skeleton minWidth="40px" />
          </div>
        </div>
      </div>
      <div className={style.coinGroupCard}>
        <div className={style.assetBalanceRow}>
          <div className={style.assetBalanceInfo}>
            <Skeleton minWidth="40px" fontSize="40px" />
            <Skeleton minWidth="80px" />
          </div>
          <div className={style.assetBalanceAmounts}>
            <Skeleton minWidth="60px" />
            <Skeleton minWidth="40px" />
          </div>
        </div>
      </div>
    </>
  );
};