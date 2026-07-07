// SPDX-License-Identifier: Apache-2.0

import { useContext } from 'react';
import type { TPortfolioPercentageType } from '@/contexts/AppContext';
import { Badge } from '@/components/badge/badge';
import { AppContext } from '@/contexts/AppContext';
import { localizePercentage } from '@/utils/localize';
import {
  ArrowDownRed,
  ArrowUpGreen,
  ChartPerformanceDark,
  ChartPerformanceWhite,
  ChartValueDark,
  ChartValueWhite,
} from '@/components/icon';
import { useDarkmode } from '@/hooks/darkmode';
import styles from './percentage-diff.module.css';
import { LocalizationContext } from '@/contexts/localization-context';

type TProps = {
  badgeVisible?: boolean;
  hasDifference: boolean;
  difference?: number;
  onClick?: () => void;
  switchedLabel?: string;
  switchedType?: TPortfolioPercentageType;
  title?: string;
};

export const PercentageDiff = ({
  badgeVisible = false,
  difference,
  hasDifference,
  onClick,
  switchedLabel,
  switchedType,
  title,
}: TProps) => {
  const { hideAmounts, nativeLocale } = useContext(AppContext);
  const { decimal, group } = useContext(LocalizationContext);
  const { isDarkMode } = useDarkmode();
  const positive = difference && difference > 0;
  const style = difference && positive ? 'up' : 'down';
  const className = hasDifference ? (styles[style] || '') : '';
  const badgeClassName = `${styles.badge || ''} ${badgeVisible ? styles.badgeVisible || '' : ''}`;
  const valueBadgeIconClassName = `${styles.badgeIcon || ''} ${styles.valueBadgeIcon || ''}`;
  const badgeIcon = switchedType === 'moneyWeightedReturn' ? (
    isDarkMode
      ? <ChartPerformanceWhite aria-hidden="true" className={styles.badgeIcon} />
      : <ChartPerformanceDark aria-hidden="true" className={styles.badgeIcon} />
  ) : (
    isDarkMode
      ? <ChartValueWhite aria-hidden="true" className={valueBadgeIconClassName} />
      : <ChartValueDark aria-hidden="true" className={valueBadgeIconClassName} />
  );
  const formattedDifference = difference && localizePercentage(difference, nativeLocale, { decimal, group });
  const content = hasDifference ? (
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
  ) : null;

  return (
    <span className={styles.container}>
      {onClick ? (
        <button
          className={`${styles.button || ''} ${className}`}
          data-testid="portfolio-percentage-toggle"
          onClick={onClick}
          title={title}
          type="button">
          {content}
        </button>
      ) : (
        <span className={className} title={title}>
          {content}
        </span>
      )}
      {switchedLabel ? (
        <Badge className={badgeClassName} type="info">
          <span className={styles.badgeContent}>
            <span>{switchedLabel}</span>
            {badgeIcon}
          </span>
        </Badge>
      ) : null}
    </span>
  );
};
