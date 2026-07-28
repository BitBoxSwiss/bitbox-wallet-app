// SPDX-License-Identifier: Apache-2.0

import type { TAmountWithConversions } from '@/api/account';
import { AmountWithUnit } from '@/components/amount/amount-with-unit';
import styles from './claim-top-up.module.css';

type TProps = {
  amount?: TAmountWithConversions;
  label: string;
};

export const AmountBlock = ({ amount, label }: TProps) => {
  if (!amount) {
    return null;
  }
  return (
    <div className={styles.amountBlock}>
      <span className={styles.blockLabel}>{label}</span>
      <div className={styles.blockAmounts}>
        <AmountWithUnit
          alwaysShowAmounts
          amount={amount}
          amountClassName={styles.amount}
        />
        <AmountWithUnit
          alwaysShowAmounts
          amount={amount}
          convertToFiat
          amountClassName={styles.fiat}
          unitClassName={styles.fiat}
        />
      </div>
    </div>
  );
};
