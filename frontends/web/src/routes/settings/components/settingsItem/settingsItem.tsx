/**
 * Copyright 2023 Shift Crypto AG
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

import { ReactNode } from 'react';
import { ChevronRightDark } from '@/components/icon';
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
}

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
}: TProps) => {
  const notButton = disabled || onClick === undefined;

  const rightContent = (
    <div className={`
    ${styles.rightContentContainer} 
    ${!notButton ? styles.extraPadding : ''}
    `}
    >
      <p className={
        `
        ${displayedValue ? styles.displayedValue : ''}
        ${extraComponent ? styles.withMargin : ''}
        ${hideDisplayedValueOnSmall ? styles.hideDisplayedValueOnSmall : ''}
       `}
      >{displayedValue}</p>
      {extraComponent ? extraComponent : null}
    </div>
  );

  const content = (
    <>
      <span className={styles.content} title={title}>
        <div className={styles.primaryText}>{settingName}</div>
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
        <div className={
          `${styles.container} ${className} 
          ${collapseOnSmall ? styles.collapse : ''}`
        } >
          {content}
        </div>
      ) : (
        <button
          type="button"
          className={`${styles.container} ${styles.isButton} ${className} 
          ${collapseOnSmall ? styles.collapse : ''}`}
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
}

export const SettingsValue = ({
  children,
  wrap,
}: TSettingsValueProps) => {
  const classNames = wrap ? '' : styles.nowrap;
  return (
    <span className={classNames}>{children}</span>
  );
};
