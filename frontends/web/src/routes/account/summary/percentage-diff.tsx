/**
 * Copyright 2024 Shift Crypto AG
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