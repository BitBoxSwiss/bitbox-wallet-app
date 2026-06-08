// SPDX-License-Identifier: Apache-2.0

import { ReactNode } from 'react';
import { RedDot } from '@/components/icon';
import styles from './settingsItem.module.css';
import { ActionableItem } from '@/components/actionable-item/actionable-item';
import { useMediaQuery } from '@/hooks/mediaquery';

type TProps = {
  icon?: ReactNode;
  className?: string;
  disabled?: boolean;
  collapseOnSmall?: boolean;
  displayedValue?: string | ReactNode;
  extraComponent?: ReactNode;
  hideDisplayedValueOnSmall?: boolean;
  onClick?: () => void;
  secondaryText?: string;
  settingName: string | ReactNode;
  title?: string;
  canUpgrade?: boolean;
};

export const SettingsItem = ({
  icon,
  className = '',
  disabled,
  collapseOnSmall = false,
  displayedValue = '',
  extraComponent,
  hideDisplayedValueOnSmall = false,
  onClick,
  secondaryText,
  settingName,
  title,
  canUpgrade = false,
}: TProps) => {
  const notButton = disabled || onClick === undefined;
  const isSmall = useMediaQuery('(max-width: 560px)');

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
      {!(collapseOnSmall && isSmall) && extraComponent}
    </div>
  );

  const content = (
    <>
      <span className={styles.content} title={title}>
        <>
          <div className={styles.primaryText}>
            {settingName}
          </div>
          {collapseOnSmall && isSmall ? (
            <div className={styles.extraComponentLarge}>
              {extraComponent}
            </div>
          )
            :
            null}
        </>
        { secondaryText ? (
          <p className={styles.secondaryText}>{secondaryText}</p>
        ) : null }
      </span>
      {rightContent}
    </>
  );

  return (
    <ActionableItem
      icon={icon}
      className={`${styles.container || ''} ${className}`}
      onClick={notButton ? undefined : onClick}
    >
      {content}
    </ActionableItem>
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
