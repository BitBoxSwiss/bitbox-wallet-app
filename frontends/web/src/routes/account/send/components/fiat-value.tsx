// SPDX-License-Identifier: Apache-2.0

import { useContext } from 'react';
import type { ConversionUnit } from '@/api/account';
import { Amount } from '@/components/amount/amount';
import { AmountUnit } from '@/components/amount/amount-with-unit';
import { RatesContext } from '@/contexts/RatesContext';
import style from './fiat-value.module.css';

type TFiatValueProps = {
  amount: string;
  baseCurrencyUnit: ConversionUnit;
  className?: string;
  enableRotateUnit?: boolean;
};

export const FiatValue = ({
  amount,
  baseCurrencyUnit,
  className,
  enableRotateUnit = false,
}: TFiatValueProps) => {
  const { rotateDefaultCurrency } = useContext(RatesContext);
  const rotateUnit = enableRotateUnit ? rotateDefaultCurrency : undefined;

  const classNames = `${style.fiatValue || ''} ${className && className || ''}`;

  return (
    <p className={classNames}>
      <Amount
        alwaysShowAmounts
        amount={amount}
        unit={baseCurrencyUnit}
        onMobileClick={rotateUnit} />
      {' '}
      <AmountUnit
        unit={baseCurrencyUnit}
        rotateUnit={rotateUnit}
        className={style.unit} />
    </p>
  );
};
