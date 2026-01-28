// SPDX-License-Identifier: Apache-2.0

import { useContext } from 'react';
import type { TAmountWithConversions, TTransactionType } from '@/api/account';
import { RatesContext } from '@/contexts/RatesContext';
import { Arrow } from '@/components/transactions/components/arrows';
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
  const conversion = amount?.conversions && amount?.conversions[defaultCurrency];

  const sign = getTxSign(type);
  const estimatedPrefix = '\u2248'; // ≈
  const sendToSelf = type === 'send_to_self';
  const recv = type === 'receive';
  const amountToShow = recv || sendToSelf ? amount : deductedAmount;
  const conversionUnit = sendToSelf ? amountToShow.unit : defaultCurrency;

  // we skip the estimated conversion prefix when the Tx is send to self, or both coin and conversion are in BTC units.
  const skipEstimatedPrefix = sendToSelf || (btcUnits.includes(conversionUnit) && btcUnits.includes(amountToShow.unit));

  return (
    <span className={styles.txConversionAmount}>
      {(conversion || sendToSelf) && amountToShow ? (
        <>
          {sendToSelf && (
            <span className={styles.txSmallInlineIcon}>
              <Arrow type="send_to_self" />
            </span>
          )}
          {amountToShow.estimated && !skipEstimatedPrefix && (
            <span className={styles.txPrefix}>{estimatedPrefix}{' '}</span>
          )}
          {conversion && conversion !== '0' && !sendToSelf ? sign : null}
          <Amount
            amount={sendToSelf ? amountToShow.amount : conversion || ''}
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
