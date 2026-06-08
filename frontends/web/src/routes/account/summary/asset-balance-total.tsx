// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { CoinCode, TAmountWithConversions } from '@/api/account';
import { AssetBalance } from './asset-balance';
import style from './accountssummary.module.css';

type Props = {
  amount?: TAmountWithConversions;
  coinCode: CoinCode;
  coinName: string;
};

export const AssetBalanceTotal = ({ amount, coinCode, coinName }: Props) => {
  const { t } = useTranslation();
  return (
    <div className={style.coinGroupTotal}>
      <AssetBalance
        amount={amount}
        coinCode={coinCode}
        coinName={
          <div className={style.totalNameCol}>
            <span className={style.totalLabel}>{t('accountSummary.total')}</span>
            <span className={style.assetBalanceName}>{coinName}</span>
          </div>
        }
      />
    </div>
  );
};
