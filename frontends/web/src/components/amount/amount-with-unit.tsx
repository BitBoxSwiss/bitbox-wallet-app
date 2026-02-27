// SPDX-License-Identifier: Apache-2.0

import { useContext } from 'react';
import type { CoinUnit, ConversionUnit, TAmountWithConversions } from '@/api/account';
import { RatesContext } from '@/contexts/RatesContext';
import { Amount } from '@/components/amount/amount';
import { isBitcoinCoin } from '@/routes/account/utils';
import style from './amount-with-unit.module.css';

type TAmountWithUnitProps = {
  amount: TAmountWithConversions | undefined;
  enableRotateUnit?: boolean;
  sign?: string;
  alwaysShowAmounts?: boolean;
  convertToFiat?: boolean;
  unitClassName?: string;
  maxDecimals?: number;
};

export const AmountWithUnit = ({
  amount,
  enableRotateUnit,
  sign,
  convertToFiat,
  alwaysShowAmounts = false,
  unitClassName = '',
  maxDecimals,
}: TAmountWithUnitProps) => {
  const { rotateDefaultCurrency, defaultCurrency, rotateBtcUnit } = useContext(RatesContext);

  if (!amount) {
    return null;
  }
  let displayedAmount: string = '';
  let displayedUnit: CoinUnit | ConversionUnit;
  let onClick: () => Promise<void>;

  if (convertToFiat) {
    // amount.conversions[defaultCurrency] can be empty in recent transactions.
    if (amount?.conversions && !!amount.conversions[defaultCurrency]) {
      displayedAmount = amount.conversions[defaultCurrency];
    }
    displayedUnit = defaultCurrency;
    onClick = rotateDefaultCurrency;
  } else {
    displayedAmount = amount.amount;
    displayedUnit = amount.unit;
    onClick = rotateBtcUnit;
  }

  const enableClick = enableRotateUnit && (convertToFiat || isBitcoinCoin(amount.unit));

  return (
    <span className={`
      ${style.rates || ''}
      ${style.availableFiatAmount || ''}
      ${!displayedAmount && style.notAvailable || ''}
    `.trim()}>
      {!!displayedAmount ? sign : ''}
      {!!displayedAmount ? (
        <Amount
          alwaysShowAmounts={alwaysShowAmounts}
          amount={displayedAmount}
          unit={displayedUnit}
          onMobileClick={enableClick ? onClick : undefined}
          maxDecimals={maxDecimals}
        />
      ) : '---'}
      {' '}
      <AmountUnit
        unit={displayedUnit}
        rotateUnit={enableClick ? onClick : undefined}
        className={unitClassName}/>
    </span>
  );
};

type TAmountUnitProps = {
  rotateUnit?: () => Promise<void>;
  unit: ConversionUnit | CoinUnit;
  className?: string;
};

export const AmountUnit = ({ rotateUnit, unit, className = '' }: TAmountUnitProps) => {
  const classRototable = rotateUnit ? (style.rotatable || '') : '';
  const textStyle = `${style.unit || ''} ${classRototable} ${className}`;
  return (
    <span data-testid={`amount-unit-${unit}`} className={textStyle} onClick={rotateUnit}>
      {unit}
    </span>
  );
};
