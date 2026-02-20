// SPDX-License-Identifier: Apache-2.0

import type { TAmountWithConversions } from '@/api/account';
import { AmountWithUnit } from '@/components/amount/amount-with-unit';
import style from './fiat-value.module.css';

type TFiatValueProps = {
  amount: TAmountWithConversions | undefined;
  className?: string;
  enableRotateUnit?: boolean;
};

export const FiatValue = ({
  amount,
  className,
  enableRotateUnit = false,
}: TFiatValueProps) => {

  const classNames = `${style.fiatValue || ''} ${className && className || ''}`;

  return (
    <p className={classNames}>
      <AmountWithUnit
        alwaysShowAmounts
        convertToFiat
        amount={amount}
        enableRotateUnit={enableRotateUnit} />
    </p>
  );
};
