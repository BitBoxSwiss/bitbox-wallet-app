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

import { i18n } from '../../../i18n/i18n';
import { localizePercentage } from '../../../utils/localize';
import styles from './percentage-diff.module.css';

export const ArrowUp = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round">
    <line x1="12" y1="19" x2="12" y2="5"></line>
    <polyline points="5 12 12 5 19 12"></polyline>
  </svg>
);

export const ArrowDown = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <polyline points="19 12 12 19 5 12"></polyline>
  </svg>
);


type TPercentageDiff = {
  hasDifference: boolean;
  difference?: number;
  hideAmounts?: boolean;
  title?: string;
};

export const PercentageDiff = ({
  difference,
  hasDifference,
  hideAmounts,
  title,
}: TPercentageDiff) => {
  const locale = i18n.language || 'en-US';
  const positive = difference && difference > 0;
  const style = difference && positive ? 'up' : 'down';
  const className = hasDifference ? styles[style] : '';
  const formattedDifference = difference && localizePercentage(difference, locale);
  return (
    <span className={className} title={title}>
      {hasDifference ? (
        <>
          <span className={styles.arrow}>
            {positive ? (
              <ArrowUp />
            ) : (
              <ArrowDown />
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