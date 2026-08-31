// SPDX-License-Identifier: Apache-2.0

import type { KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import * as accountApi from '@/api/account';
import { Skeleton } from '@/components/skeleton/skeleton';
import { BalanceSection } from './balance-section';
import { AssetBalanceWithUnitPrice } from './asset-balance-with-unit-price';
import style from './accountssummary.module.css';

type TCoinBalance = accountApi.CoinFormattedOptionalAmount & {
  coinUnit?: accountApi.CoinUnit;
};

type TProps = {
  hideHeader?: boolean;
  hideLightningUnitPrice?: boolean;
  summaryData?: accountApi.TChartData;
  coinsBalances?: TCoinBalance[];
};

export const TotalBalanceForAllKeystores = ({
  hideHeader,
  hideLightningUnitPrice,
  summaryData,
  coinsBalances,
}: TProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const openLightning = () => navigate('/lightning');
  return (
    <BalanceSection
      hideHeader={hideHeader}
      name={<span>{t('accountSummary.totalAssets')}</span>}
      totalAmount={summaryData?.formattedChartTotal ?? undefined}
      fiatUnit={summaryData?.chartFiat}
    >
      {coinsBalances === undefined ? (
        <LoadingSkeleton />
      ) : coinsBalances.map((balance) => {
        const isLightning = balance.coinCode === 'lightning';
        const onLightningKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
          if (event.key !== 'Enter' && event.key !== ' ') {
            return;
          }
          event.preventDefault();
          openLightning();
        };

        return (
          <div
            key={balance.coinCode}
            className={`
              ${style.coinGroupCard || ''}
              ${isLightning ? style.clickable || '' : ''}
            `}
            onClick={isLightning ? openLightning : undefined}
            onKeyDown={isLightning ? onLightningKeyDown : undefined}
            role={isLightning ? 'button' : undefined}
            tabIndex={isLightning ? 0 : undefined}
          >
            <AssetBalanceWithUnitPrice
              amount={balance.formattedAmount}
              coinCode={balance.coinCode}
              coinName={balance.coinName}
              coinUnit={balance.coinUnit}
              showUnitPrice={!isLightning || !hideLightningUnitPrice}
            />
          </div>
        );
      })}
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
