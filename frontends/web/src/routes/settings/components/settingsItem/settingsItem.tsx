// SPDX-License-Identifier: Apache-2.0

import { ReactNode } from 'react';
import { ChevronRightDark, RedDot } from '@/components/icon';
import styles from './settingsItem.module.css';

type TProps = {
  className?: string;
  disabled?: boolean;
  collapseOnSmall?: boolean;
  displayedValue?: string | ReactNode;
  extraComponent?: ReactNode;
  hideChevron?: boolean;
  hideDisplayedValueOnSmall?: boolean;
  onClick?: () => void;
  secondaryText?: string;
  settingName: string | ReactNode;
  title?: string;
  canUpgrade?: boolean;
};

export const SettingsItem = ({
  className = '',
  disabled,
  collapseOnSmall = false,
  displayedValue = '',
  extraComponent,
  hideChevron = false,
  hideDisplayedValueOnSmall = false,
  onClick,
  secondaryText,
  settingName,
  title,
  canUpgrade = false,
}: TProps) => {
  const notButton = disabled || onClick === undefined;

  const rightContent = (
    <div className={`
      ${styles.rightContentContainer || ''}
      ${!notButton && styles.extraPadding || ''}
    `}>
      {displayedValue && (
        <p className={`
          ${displayedValue && styles.displayedValue || ''}
          ${extraComponent && styles.withMargin || ''}
          ${hideDisplayedValueOnSmall && styles.hideDisplayedValueOnSmall || ''}
        `}>
          {displayedValue}
        </p>
      )}
      {canUpgrade && <RedDot width={8} height={8} />}
      {extraComponent ? extraComponent : null}
    </div>
  );

  const content = (
    <>
      <span className={styles.content} title={title}>
        <div className={styles.primaryText}>
          {settingName}
        </div>
        { secondaryText ? (
          <p className={styles.secondaryText}>{secondaryText}</p>
        ) : null }
      </span>
      {rightContent}
    </>
  );

  // render as div when it's notButton
  // otherwise, render as button
  return (
    <>
      {notButton ? (
        <div className={`
          ${styles.container || ''}
          ${className}
          ${collapseOnSmall && styles.collapse || ''}
        `}>
          {content}
        </div>
      ) : (
        <button
          type="button"
          className={`
            ${styles.container || ''}
            ${styles.isButton || ''}
            ${className}
            ${collapseOnSmall && styles.collapse || ''}
          `}
          onClick={onClick}>
          {content}
          {!hideChevron && (
            <ChevronRightDark
              className={styles.chevronRight}
              width={24}
              height={24}
            />
          )}
        </button>
      )}
    </>
  );
};

type TSettingsValueProps = {
  children: ReactNode;
  wrap?: boolean;
};

export const SettingsValue = ({
  children,
  wrap,
}: TSettingsValueProps) => {
  const classNames = wrap ? '' : styles.nowrap;
  return (
    <span className={classNames}>{children}</span>
  );
};
