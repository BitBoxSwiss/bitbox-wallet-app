import { ReactNode } from 'react';
import { CoinCode, TAmountWithConversions } from '@/api/account';
import { AmountWithUnit } from '@/components/amount/amount-with-unit';
import { Logo } from '@/components/icon/logo';
import { Skeleton } from '@/components/skeleton/skeleton';
import { useCoinUnitPrice } from '@/hooks/coin-unit-price';
import { useFlexWrap } from '@/hooks/flex-wrap';
import style from './accountssummary.module.css';

type Props = {
  amount?: TAmountWithConversions;
  coinCode: CoinCode;
  coinName: ReactNode;
  showUnitPrice?: boolean;
};

export const AssetBalance = ({ amount, coinCode, coinName, showUnitPrice = true }: Props) => {
  const unitPrice = useCoinUnitPrice(coinCode, amount?.unit);
  const { ref, isWrapped } = useFlexWrap<HTMLDivElement>();
  return (
    <div className={style.assetBalanceRow}>
      <div className={style.assetBalanceInfo}>
        <Logo coinCode={coinCode} active={true} alt={coinCode} />
        <div className={style.assetBalanceNameCol}>
          <span>{coinName}</span>
          {showUnitPrice && (
            <AmountWithUnit
              amountClassName={style.unitPrice}
              amount={unitPrice}
              convertToFiat />
          )}
        </div>
      </div>
      <div ref={ref} className={`${style.assetBalanceAmounts || ''} ${isWrapped ? style.assetBalanceAmountsWrapped || '' : ''}`}>
        {amount ? (
          <>
            <AmountWithUnit amount={amount}/>
            <AmountWithUnit amount={amount} convertToFiat/>
          </>
        ) : (
          <>
            <Skeleton minWidth="60px" />
            <Skeleton minWidth="40px" />
          </>
        )}
      </div>
    </div>
  );
};
