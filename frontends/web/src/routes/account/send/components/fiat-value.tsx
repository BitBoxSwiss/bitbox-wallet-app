// SPDX-License-Identifier: Apache-2.0

import type { ConversionUnit } from '@/api/account';
import { Amount } from '@/components/amount/amount';
import style from './fiat-value.module.css';

type TFiatValueProps = {
  amount: string;
  baseCurrencyUnit: ConversionUnit;
  className?: string;
};

export const FiatValue = ({
  amount,
  baseCurrencyUnit,
  className,
}: TFiatValueProps) => {

  const classNames = `${style.fiatValue || ''} ${className && className || ''}`;

  return (
    <p className={classNames}>
      <Amount
        alwaysShowAmounts
        amount={amount}
        unit={baseCurrencyUnit} />
      {' '}
      <span className={style.unit}>
        {baseCurrencyUnit}
      </span>
    </p>
  );
};
