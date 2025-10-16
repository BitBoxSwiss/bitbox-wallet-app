/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2020-2025 Shift Crypto AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { useContext } from 'react';
import type { CoinUnit, ConversionUnit, TAmountWithConversions } from '@/api/account';
import { RatesContext } from '@/contexts/RatesContext';
import { Amount } from '@/components/amount/amount';
import { isBitcoinCoin } from '@/routes/account/utils';
import style from './amount-with-unit.module.css';

type TAmountWithUnitProps = {
  amount: TAmountWithConversions | undefined;
  tableRow?: boolean;
  enableRotateUnit?: boolean;
  sign?: string;
  alwaysShowAmounts?: boolean;
  convertToFiat?: boolean;
};

export const AmountWithUnit = ({
  amount,
  tableRow,
  enableRotateUnit: rotateUnit,
  sign,
  convertToFiat,
  alwaysShowAmounts = false
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

  const enableClick = rotateUnit && (convertToFiat || isBitcoinCoin(amount.unit));
  const formattedAmount = !!displayedAmount ?
    (
      <Amount
        alwaysShowAmounts={alwaysShowAmounts}
        amount={displayedAmount}
        unit={displayedUnit}
        onMobileClick={enableClick ? onClick : undefined}
      />
    ) : '---';

  const amountUnit = <AmountUnit unit={displayedUnit} rotateUnit={enableClick ? onClick : undefined}/>;

  if (tableRow) {
    return (
      <tr className={style.fiatRow}>
        <td className={style.availableFiatAmount}>{formattedAmount}</td>
        <td>{amountUnit}</td>
      </tr>
    );
  }
  return (
    <span className={`
      ${style.rates || ''}
      ${!displayedAmount && style.notAvailable || ''}
    `.trim()}>
      {!!displayedAmount ? sign : ''}
      {formattedAmount}
      {' '}
      {amountUnit}
    </span>
  );
};

type TAmountUnitProps = {
  rotateUnit?: () => Promise<void>;
  unit: ConversionUnit | CoinUnit;
};

export const AmountUnit = ({ rotateUnit, unit }: TAmountUnitProps) => {
  const classRototable = rotateUnit ? (style.rotatable || '') : '';
  const textStyle = `${style.unit || ''} ${classRototable}`;
  return (
    <span className={textStyle} onClick={rotateUnit}>
      {unit}
    </span>
  );
};
