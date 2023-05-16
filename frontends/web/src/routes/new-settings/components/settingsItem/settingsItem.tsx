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
import styles from './settingsItem.module.css';

type TProps = {
    className?: string
    onClick?: () => void;
    settingName: string | ReactNode;
    secondaryText?: string;
    displayedValue?: string;
    extraComponent?: ReactNode;
}

export const SettingsItem = ({
  className = '',
  onClick,
  settingName,
  secondaryText,
  displayedValue = '',
  extraComponent,
}: TProps) => {
  const notButton = onClick === undefined;

  const rightContent = (
    <div className={styles.rightContentContainer}>
      <p className={`${styles.displayedValue} ${extraComponent ? `${styles.withMargin}` : ''}`}>{displayedValue}</p>
      {extraComponent ? extraComponent : null }
    </div>
  );

  const content =
    (<>
      <span>
        {typeof settingName === 'string' ? <p className={styles.primaryText}>{settingName}</p> : settingName }
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
      {notButton ?
        <div className={`${styles.container} ${className}`} >
          {content}
        </div> :
        <button
          className={`${styles.container} ${styles.isButton} ${className}`}
          onClick={onClick}>
          {content}
        </button> }
    </>
  );
};
