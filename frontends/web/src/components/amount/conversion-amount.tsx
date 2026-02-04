// SPDX-License-Identifier: Apache-2.0

import { useContext } from 'react';
import type { TAmountWithConversions, TTransactionType } from '@/api/account';
import { RatesContext } from '@/contexts/RatesContext';
import { Amount } from '@/components/amount/amount';
import { getTxSign } from '@/utils/transaction';
import styles from './conversion-amount.module.css';

type TConversionAmountProps = {
  amount: TAmountWithConversions;
  deductedAmount: TAmountWithConversions;
  type: TTransactionType;
};

const btcUnits: Readonly<string[]> = ['BTC', 'TBTC', 'sat', 'tsat'];

/**
 * Renders a formattted conversion amount optionally with send-to-self icon or estimate symbol
 */
export const ConversionAmount = ({
  amount,
  deductedAmount,
  type,
}: TConversionAmountProps) => {
  const { defaultCurrency } = useContext(RatesContext);

  const sign = getTxSign(type);
  const estimatedPrefix = '\u2248'; // ≈
  const recv = type === 'receive';
  const amountToShow = recv ? amount : deductedAmount;
  const conversionUnit = defaultCurrency;
  const conversion = amountToShow?.conversions && amountToShow?.conversions[defaultCurrency];

  // we skip the estimated conversion prefix when both coin and conversion are in BTC units.
  const skipEstimatedPrefix = btcUnits.includes(conversionUnit) && btcUnits.includes(amountToShow.unit);

  return (
    <span className={styles.txConversionAmount}>
      {conversion && amountToShow ? (
        <>
          {amountToShow.estimated && !skipEstimatedPrefix && (
            <span className={styles.txPrefix}>{estimatedPrefix}{' '}</span>
          )}
          {conversion !== '0' ? sign : null}
          <Amount
            amount={conversion || ''}
            unit={conversionUnit}
          />
          <span className={styles.txUnit}>
            {' '}
            {conversionUnit}
          </span>
        </>
      ) : null }
    </span>
  );
};
