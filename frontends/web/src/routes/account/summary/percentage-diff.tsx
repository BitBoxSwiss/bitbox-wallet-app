// SPDX-License-Identifier: Apache-2.0

import { useContext } from 'react';
import { AppContext } from '@/contexts/AppContext';
import { localizePercentage } from '@/utils/localize';
import { ArrowDownRed, ArrowUpGreen } from '@/components/icon';
import styles from './percentage-diff.module.css';

type TPercentageDiff = {
  hasDifference: boolean;
  difference?: number;
  title?: string;
};

export const PercentageDiff = ({
  difference,
  hasDifference,
  title,
}: TPercentageDiff) => {
  const { hideAmounts, nativeLocale } = useContext(AppContext);
  const positive = difference && difference > 0;
  const style = difference && positive ? 'up' : 'down';
  const className = hasDifference ? styles[style] : '';
  const formattedDifference = difference && localizePercentage(difference, nativeLocale);
  return (
    <span className={className} title={title}>
      {hasDifference ? (
        <>
          <span className={styles.arrow}>
            {positive ? (
              <ArrowUpGreen />
            ) : (
              <ArrowDownRed />
            )}
          </span>
          <span className={styles.diffValue}>
            {hideAmounts ? '***' : formattedDifference}
            <span className={styles.diffUnit}>%</span>
          </span>
        </>
      ) : null}
    </span>
  );
};