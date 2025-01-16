/**
 * Copyright 2025 Shift Crypto AG
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
import type { IAmount, TTransactionType } from '@/api/account';
import { RatesContext } from '@/contexts/RatesContext';
import { Arrow } from '@/components/transactions/components/arrows';
import { Amount } from '@/components/amount/amount';
import { getTxSign } from '@/utils/transaction';
import styles from './conversion-amount.module.css';

type TConversionAmountProps = {
  amount: IAmount;
  type: TTransactionType;
}

const btcUnits: Readonly<string[]> = ['BTC', 'TBTC', 'sat', 'tsat'];

/**
 * Renders a formattted conversion amount optionally with send-to-self icon or estimate symbol
 */
export const ConversionAmount = ({
  amount,
  type,
}: TConversionAmountProps) => {
  const { defaultCurrency } = useContext(RatesContext);
  const conversion = amount?.conversions && amount?.conversions[defaultCurrency];
  const sign = getTxSign(type);
  const estimatedPrefix = '\u2248'; // ≈
  const sendToSelf = type === 'send_to_self';
  const conversionUnit = sendToSelf ? amount.unit : defaultCurrency;

  // we skip the estimated conversion prefix when the Tx is send to self, or both coin and conversion are in BTC units.
  const skipEstimatedPrefix = sendToSelf || (btcUnits.includes(conversionUnit) && btcUnits.includes(amount.unit));

  return (
    <span className={styles.txConversionAmount}>
      {sendToSelf && (
        <span className={styles.txSmallInlineIcon}>
          <Arrow type="send_to_self" />
        </span>
      )}
      {amount.estimated && !skipEstimatedPrefix && (
        <span className={styles.txPrefix}>
          {estimatedPrefix}
          {' '}
        </span>
      )}
      {conversion && !sendToSelf ? sign : null}
      <Amount
        amount={sendToSelf ? amount.amount : conversion || ''}
        unit={conversionUnit}
      />
      <span className={styles.txUnit}>
        {' '}
        {conversionUnit}
      </span>
    </span>
  );
};
