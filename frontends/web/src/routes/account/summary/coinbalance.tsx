// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import * as accountApi from '@/api/account';
import { SubTotalCoinRow } from './subtotalrow';
import { Amount } from '@/components/amount/amount';
import { Skeleton } from '@/components/skeleton/skeleton';
import style from './accountssummary.module.css';

type TProps = {
  summaryData?: accountApi.TChartData;
  coinsBalances?: accountApi.CoinFormattedAmount[];
};

export const CoinBalance = ({
  summaryData,
  coinsBalances = [],
}: TProps) => {
  const { t } = useTranslation();

  return (
    <div>
      <div className={style.accountName}>
        <p>{t('accountSummary.total')}</p>
      </div>
      <div className={style.balanceTable}>
        <table className={style.table}>
          <colgroup>
            <col width="33%" />
            <col width="33%" />
            <col width="*" />
          </colgroup>
          <thead>
            <tr>
              <th>{t('accountSummary.coin')}</th>
              <th>{t('accountSummary.balance')}</th>
              <th>{t('accountSummary.fiatBalance')}</th>
            </tr>
          </thead>
          <tbody>
            {coinsBalances.length > 0 ? (
              coinsBalances.map((balance) => (
                <SubTotalCoinRow
                  key={balance.coinCode}
                  coinCode={balance.coinCode}
                  coinName={balance.coinName}
                  balance={balance.formattedAmount}
                />
              ))
            ) : null}
          </tbody>
          <tfoot>
            <tr>
              <th>
                <strong>{t('accountSummary.total')}</strong>
              </th>
              <td colSpan={2}>
                {(summaryData && summaryData.formattedChartTotal !== null) ? (
                  <strong className={style.summaryTableBalance}>
                    <Amount
                      amount={summaryData.formattedChartTotal}
                      unit={summaryData.chartFiat}
                    />
                    <span className={style.coinUnit}>
                      {summaryData.chartFiat}
                    </span>
                  </strong>
                ) : (<Skeleton />) }
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
