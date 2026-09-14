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
  ariaLabel?: string;
  badgeVisible?: boolean;
  difference?: number | null;
  onClick?: () => void;
  switchedLabel?: string;
  switchedType?: TPortfolioPercentageType;
  title?: string;
};

export const PercentageDiff = ({
  ariaLabel,
  badgeVisible = false,
  difference,
  onClick,
  switchedLabel,
  switchedType,
  title,
}: TProps) => {
  const { hideAmounts, nativeLocale, portfolioPercentageType } = useContext(AppContext);
  const { decimal, group } = useContext(LocalizationContext);
  const { isDarkMode } = useDarkmode();
  const differenceAvailable = (
    difference !== undefined
    && difference !== null
    && Number.isFinite(difference)
  );
  const positive = differenceAvailable && difference > 0;
  const negative = differenceAvailable && difference < 0;
  const className = positive ? styles.up || '' : negative ? styles.down || '' : '';
  const showUnavailableToggle = difference === null && onClick !== undefined;
  const showToggle = onClick !== undefined && (differenceAvailable || showUnavailableToggle);
  const badgeClassName = `${styles.badge || ''} ${badgeVisible ? styles.badgeVisible || '' : ''}`;
  const valueBadgeIconClassName = `${styles.badgeIcon || ''} ${styles.valueBadgeIcon || ''}`;
  const badgeIcon = (
    switchedType === 'moneyWeightedReturn' ? (
      isDarkMode
        ? <ChartPerformanceWhite aria-hidden="true" className={styles.badgeIcon} />
        : <ChartPerformanceDark aria-hidden="true" className={styles.badgeIcon} />
    ) : (
      isDarkMode
        ? <ChartValueWhite aria-hidden="true" className={valueBadgeIconClassName} />
        : <ChartValueDark aria-hidden="true" className={valueBadgeIconClassName} />
    )
  );
  const formattedDifference = (
    differenceAvailable
      ? localizePercentage(difference, nativeLocale, { decimal, group })
      : undefined
  );
  const unavailableIcon = (
    portfolioPercentageType === 'value' ? (
      isDarkMode
        ? <ChartPerformanceWhite aria-hidden="true" className={styles.unavailableIcon} />
        : <ChartPerformanceDark aria-hidden="true" className={styles.unavailableIcon} />
    ) : (
      isDarkMode
        ? <ChartValueWhite aria-hidden="true" className={styles.unavailableIcon} />
        : <ChartValueDark aria-hidden="true" className={styles.unavailableIcon} />
    )
  );
  const content = (
    differenceAvailable ? (
      <>
        {positive || negative ? (
          <span className={styles.arrow}>
            {positive ? <ArrowUpGreen /> : <ArrowDownRed />}
          </span>
        ) : null}
        <span className={styles.diffValue}>
          {hideAmounts ? '***' : formattedDifference}
          <span className={styles.diffUnit}>%</span>
        </span>
      </>
    ) : showUnavailableToggle ? unavailableIcon : null
  );

  return (
    <span className={styles.container}>
      {showToggle ? (
        <button
          aria-label={ariaLabel}
          className={`${styles.button || ''} ${className} ${showUnavailableToggle ? styles.unavailableButton || '' : ''}`}
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
